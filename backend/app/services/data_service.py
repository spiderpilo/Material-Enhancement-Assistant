from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

import psycopg2.extras
from pydantic import ValidationError

from app.services import auth_service, db, storage_service
from app.services.errors import (  # noqa: F401 - error types re-exported for API routes
    AccountConflictError,
    AuthenticationError,
    DataServiceError,
    InvalidCredentialsError,
    MissingConfigError,
)
from app.models.account_model import (
    CreateAccountResponse,
    CurrentUserResponse,
    LoginAccountResponse,
    UserProfileRecord,
)
from app.models.chat_model import (
    ProjectChatHistoryResponse,
    ProjectChatMessageRecord,
    ProjectChatResponse,
    ProjectChatSourceRecord,
)
from app.models.document_model import (
    CourseContentFileResponse,
    CourseContentPreviewItem,
    CourseContentPreviewManifest,
    CourseContentRecord,
    PreviewStatus,
    SourceType,
)
from app.models.generated_material_model import GeneratedMaterialRecord
from app.models.project_model import ProjectMaterialRecord, ProjectRecord, ProjectSummary
from app.models.quiz_model import GeneratedQuiz, GeneratedQuizHistoryRecord, QuizSourceMaterial
from app.services.export_service import build_slide_deck_pptx_bytes
from app.services.embedding_service import (
    EmbeddedTextChunk,
    GeminiEmbeddingError,
    MissingGeminiAPIKeyError,
    TextChunk,
    chunk_text,
    embed_chunks,
    embed_text,
)
from app.services.llm_service import (
    answer_project_question as generate_project_chat_answer,
    generate_quiz_with_usage,
    generate_slide_deck_outline_with_usage,
)
from app.services.parser_service import DocumentParseError, ParsedTextUnit, parse_document, parse_document_units
from app.services.preview_service import (
    DocumentPreviewError,
    convert_pptx_to_pdf_bytes,
    render_course_content_previews,
)
from app.utils.file_utils import sanitize_filename


PREVIEW_STORAGE_PREFIX = "course-content-previews"
GENERATED_MATERIALS_STORAGE_PREFIX = "generated-materials"
PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
PDF_CONTENT_TYPE = "application/pdf"
logger = logging.getLogger(__name__)
LEGACY_PROJECTS_NOT_NULL_COLUMNS = ("created_by", "owner_auth_user_id")
CHAT_MEMORY_LIMIT = 10


class PreviewNotFoundError(DataServiceError):
    """Raised when no preview bootstrap or manifest exists for a source id."""


class ProjectNotFoundError(DataServiceError):
    """Raised when a project does not exist or is not owned by the current user."""


class ProjectAccessDeniedError(DataServiceError):
    """Raised when a project exists but is not owned by the current user."""


class GeneratedMaterialNotFoundError(DataServiceError):
    """Raised when a generated material record cannot be found for a project."""


class DuplicateCourseContentError(DataServiceError):
    """Raised when the same source bytes already exist in a project."""


class StoredFileMissingError(DataServiceError):
    """Raised when a material's original file is not in object storage."""


class InvalidStorageLocationError(DataServiceError):
    """Raised when a material's stored URL does not point into the configured bucket."""


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    session_id: str
    email: str
    username: str
    profession: str


@dataclass(frozen=True)
class SlideDeckPreviewBuildResult:
    payload: dict[str, Any]
    storage_paths: list[str]


@dataclass(frozen=True)
class RagRetrievedChunk:
    course_content_id: int
    material_name: str
    chunk_index: int
    text: str
    similarity: float
    location_kind: str | None = None
    location_start: int | None = None
    location_end: int | None = None


def login_account(*, email: str, password: str, user_agent: str | None = None) -> LoginAccountResponse:
    user = auth_service.authenticate(email=email, password=password)
    tokens = auth_service.issue_tokens(user, user_agent=user_agent)
    return _build_login_response(user=user, tokens=tokens)


def refresh_session(*, refresh_token: str) -> LoginAccountResponse:
    user, tokens = auth_service.rotate_refresh_token(refresh_token)
    return _build_login_response(user=user, tokens=tokens)


def logout_session(*, access_token: str) -> None:
    auth_user = _resolve_authenticated_user(access_token=access_token)
    auth_service.revoke_session(auth_user.session_id)


def get_current_user(*, access_token: str) -> CurrentUserResponse:
    auth_user = _resolve_authenticated_user(access_token=access_token)
    return CurrentUserResponse(
        user_id=auth_user.user_id,
        email=auth_user.email,
        username=auth_user.username,
        profession=auth_user.profession,
    )


def _build_login_response(
    *,
    user: auth_service.AuthUser,
    tokens: auth_service.IssuedTokens,
) -> LoginAccountResponse:
    username = user.user_metadata.get("username")
    profession = user.user_metadata.get("profession")

    return LoginAccountResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        refresh_expires_in=tokens.refresh_expires_in,
        user_id=user.id,
        email=user.email,
        username=username if isinstance(username, str) else "",
        profession=profession if isinstance(profession, str) else "",
    )


def create_account(
    *,
    email: str,
    password: str,
    username: str,
    profession: str,
    user_agent: str | None = None,
) -> CreateAccountResponse:
    with db.transaction() as cursor:
        auth_user = auth_service.insert_auth_user(
            cursor,
            email=email,
            password=password,
            user_metadata={
                "username": username,
                "profession": profession,
                "email_verified": True,
            },
        )
        cursor.execute(
            """
            INSERT INTO public.users (username, profession, user_uuid)
            VALUES (%s, %s, %s::uuid)
            ON CONFLICT (username) DO NOTHING
            RETURNING *
            """,
            (username, profession, auth_user.id),
        )
        profile_row = cursor.fetchone()
        if profile_row is None:
            raise AccountConflictError(f"Username {username} is already taken.")
        tokens = auth_service.issue_tokens(auth_user, user_agent=user_agent, cursor=cursor)

    login_response = _build_login_response(user=auth_user, tokens=tokens)
    return CreateAccountResponse(
        **login_response.model_dump(),
        auth_user_id=auth_user.id,
        profile=UserProfileRecord.model_validate(db.normalize_rows([profile_row])[0]),
    )


def list_projects_for_user(*, access_token: str, limit: int | None = None) -> list[ProjectSummary]:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )

    projects = _fetch_project_rows_for_owner(
        owner_user_id=auth_user.user_id,
        limit=limit,
    )

    return [_build_project_summary(
            project_row=project,
        )
        for project in projects
    ]


def create_project_for_user(*, access_token: str, name: str) -> ProjectSummary:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    profile = _get_user_profile_optional(
        auth_user=auth_user,
    )

    try:
        project_row = _insert_project_record(
            name=name,
            owner_user_id=auth_user.user_id,
        )
    except DataServiceError as exc:
        if not _is_legacy_projects_not_null_error(exc):
            raise

        legacy_created_by: str | int = profile.id if profile else auth_user.user_id
        logger.warning(
            "Retrying project insert with legacy columns because projects schema is mixed-contract: %s",
            exc,
        )
        try:
            project_row = _insert_project_record(
                name=name,
                owner_user_id=auth_user.user_id,
                owner_auth_user_id=auth_user.user_id,
                created_by=legacy_created_by,
            )
        except DataServiceError as retry_exc:
            if _is_legacy_projects_not_null_error(retry_exc):
                raise DataServiceError(
                    _build_legacy_projects_migration_hint_message(str(retry_exc))
                ) from retry_exc
            raise

    if profile:
        try:
            _insert_user_project_link(
                user_id=profile.id,
                project_id=_read_int(project_row, "id"),
            )
        except DataServiceError as exc:
            logger.warning("Skipping user_projects link for project_id=%s: %s", project_row.get("id"), exc)

    return _build_project_summary(
        project_row=project_row,
    )


def get_project_for_user(*, access_token: str, project_uuid: str) -> ProjectRecord:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    return _build_project_record(
        project_row=_fetch_owned_project_detail_row(
            project_uuid=project_uuid,
            owner_user_id=auth_user.user_id,
        ),
    )


def update_project_for_user(*, access_token: str, project_uuid: str, name: str) -> ProjectRecord:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    project_row = _fetch_project_row_by_uuid(
        project_uuid=project_uuid,
    )
    project_owner_user_id = project_row.get("owner_user_id")
    if not isinstance(project_owner_user_id, str) or not project_owner_user_id.strip():
        raise DataServiceError("Project row is missing an owner_user_id.")
    if project_owner_user_id != auth_user.user_id:
        raise ProjectAccessDeniedError("You do not have permission to update this project.")

    project_id = _read_int(project_row, "id")
    _update_project_record(
        project_id=project_id,
        name=name,
    )

    return _build_project_record(
        project_row=_fetch_owned_project_detail_row(
            project_uuid=project_uuid,
            owner_user_id=auth_user.user_id,
        ),
    )


def delete_project_for_user(*, access_token: str, project_uuid: str) -> None:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    project_row = _fetch_project_row_by_uuid(
        project_uuid=project_uuid,
    )
    project_owner_user_id = project_row.get("owner_user_id")
    if not isinstance(project_owner_user_id, str) or not project_owner_user_id.strip():
        raise DataServiceError("Project row is missing an owner_user_id.")
    if project_owner_user_id != auth_user.user_id:
        raise ProjectAccessDeniedError("You do not have permission to delete this project.")

    project_id = _read_int(project_row, "id")
    material_links = _fetch_project_material_links(
        project_id=project_id,
    )
    for link in material_links:
        material_id = _read_optional_int(link, "material_id")
        if material_id is None:
            continue
        cleanup_error = _delete_project_material_link(
            project_id=project_id,
            material_id=material_id,
        )
        if cleanup_error:
            raise DataServiceError(cleanup_error)

    user_project_cleanup_error = _delete_user_project_links_for_project(
        project_id=project_id,
    )
    if user_project_cleanup_error:
        raise DataServiceError(user_project_cleanup_error)

    delete_error = _delete_project_record(
        project_id=project_id,
    )
    if delete_error:
        raise DataServiceError(delete_error)


def upload_course_content(
    *,
    filename: str,
    file_bytes: bytes,
    project_id: int,
    access_token: str,
) -> CourseContentRecord:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    _fetch_owned_project_row(
        project_id=project_id,
        owner_user_id=auth_user.user_id,
    )
    content_sha256 = _compute_content_sha256(file_bytes)
    duplicate_record = _fetch_duplicate_course_content_for_project(
        project_id=project_id,
        content_sha256=content_sha256,
    )
    if duplicate_record:
        raise DuplicateCourseContentError(
            f"{duplicate_record.material_name} has already been uploaded to this project."
        )

    storage_path = _build_storage_path(filename)
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    _upload_storage_object(
        storage_path=storage_path,
        file_bytes=file_bytes,
        content_type=content_type,
    )

    access_url = _build_object_url(
        storage_path=storage_path,
    )

    try:
        inserted_record = _insert_course_content_record(
            filename=filename,
            access_url=access_url,
            data_size=len(file_bytes),
            project_id=project_id,
            content_sha256=content_sha256,
        )
        _insert_project_material_link(
            project_id=project_id,
            material_id=inserted_record.id,
        )
        source_type = _detect_source_type(filename)
        preview_record = inserted_record.model_copy(
            update={
                "source_type": source_type,
                "preview_status": "pending",
                "preview_count": 0,
                "rag_status": "pending",
                "rag_chunk_count": 0,
                "rag_error": None,
            }
        )
        _upload_preview_status(
            course_content_id=preview_record.id,
            material_name=preview_record.material_name,
            access_url=preview_record.access_url,
            source_type=source_type,
            preview_status="pending",
            preview_count=0,
            preview_error=None,
        )
        logger.info(
            "Stored preview bootstrap for course_content_id=%s",
            preview_record.id,
        )
        return preview_record
    except DataServiceError as exc:
        logger.error(
            "Preview bootstrap write failed for filename=%s: %s",
            filename,
            exc,
        )

        cleanup_messages: list[str] = []

        if "inserted_record" in locals():
            cleanup_link_error = _delete_project_material_link(
                project_id=project_id,
                material_id=inserted_record.id,
            )
            if cleanup_link_error:
                cleanup_messages.append(cleanup_link_error)

            cleanup_record_error = _delete_course_content_record(
                course_content_id=inserted_record.id,
            )
            if cleanup_record_error:
                cleanup_messages.append(cleanup_record_error)

        cleanup_error = _delete_storage_object(
            storage_path=storage_path,
        )
        if cleanup_error:
            cleanup_messages.append(cleanup_error)

        if cleanup_messages:
            raise DataServiceError(
                f"{exc} Cleanup failed: {' | '.join(cleanup_messages)}"
            ) from exc
        raise


def generate_course_content_preview_assets(
    *,
    course_content_id: int,
    filename: str,
    access_url: str,
    file_bytes: bytes,
) -> None:
    source_type = _detect_source_type(filename)

    try:
        _upload_preview_status(
            course_content_id=course_content_id,
            material_name=filename,
            access_url=access_url,
            source_type=source_type,
            preview_status="pending",
            preview_count=0,
            preview_error=None,
        )
        rendered_source_type, rendered_items = render_course_content_previews(
            filename=filename,
            file_bytes=file_bytes,
        )
        manifest_items: list[CourseContentPreviewItem] = []

        for item in rendered_items:
            storage_path = _build_preview_item_storage_path(
                course_content_id=course_content_id,
                image_name=item.image_name,
            )
            _upload_or_replace_storage_object(
                storage_path=storage_path,
                file_bytes=item.image_bytes,
                content_type="image/png",
            )
            manifest_items.append(
                CourseContentPreviewItem(
                    id=f"{course_content_id}-{item.index}",
                    index=item.index,
                    kind=item.kind,
                    label=item.label,
                    title=item.title,
                    subtitle=item.subtitle,
                    image_url=_build_object_url(
                        storage_path=storage_path,
                    ),
                    width=item.width,
                    height=item.height,
                )
            )

        manifest = CourseContentPreviewManifest(
            course_content_id=course_content_id,
            material_name=filename,
            source_type=rendered_source_type,
            preview_status="ready",
            preview_count=len(manifest_items),
            access_url=access_url,
            preview_error=None,
            items=manifest_items,
        )

        _upload_preview_manifest(
            course_content_id=course_content_id,
            manifest=manifest,
        )
        _upload_preview_status(
            course_content_id=course_content_id,
            material_name=filename,
            access_url=access_url,
            source_type=rendered_source_type,
            preview_status="ready",
            preview_count=len(manifest_items),
            preview_error=None,
        )
        logger.info(
            "Stored preview manifest for course_content_id=%s with %s items",
            course_content_id,
            len(manifest_items),
        )
    except (DocumentPreviewError, DataServiceError, MissingConfigError) as exc:
        logger.error(
            "Preview render failed for course_content_id=%s: %s",
            course_content_id,
            exc,
        )
        _upload_preview_status(
            course_content_id=course_content_id,
            material_name=filename,
            access_url=access_url,
            source_type=source_type,
            preview_status="failed",
            preview_count=0,
            preview_error=str(exc),
        )


def generate_course_content_rag_index(
    *,
    course_content_id: int,
    project_id: int,
    filename: str,
    file_bytes: bytes,
) -> None:
    source_type = _detect_source_type(filename)

    try:
        _update_course_content_rag_status(
            course_content_id=course_content_id,
            rag_status="pending",
            rag_chunk_count=0,
            rag_error=None,
        )
        parsed_units = parse_document_units(file_bytes=file_bytes, file_type=source_type)
        chunks = _chunk_parsed_text_units(parsed_units)
        if not chunks:
            raise DataServiceError("No text chunks could be created from the uploaded file.")

        embedded_chunks = embed_chunks(chunks)
        _replace_course_content_chunks(
            project_id=project_id,
            course_content_id=course_content_id,
            material_name=filename,
            embedded_chunks=embedded_chunks,
        )
        _update_course_content_rag_status(
            course_content_id=course_content_id,
            rag_status="ready",
            rag_chunk_count=len(embedded_chunks),
            rag_error=None,
        )
        logger.info(
            "Stored RAG chunks for course_content_id=%s chunk_count=%s",
            course_content_id,
            len(embedded_chunks),
        )
    except (
        DocumentParseError,
        MissingGeminiAPIKeyError,
        GeminiEmbeddingError,
        DataServiceError,
        ValueError,
    ) as exc:
        logger.error(
            "RAG indexing failed for course_content_id=%s: %s",
            course_content_id,
            exc,
        )
        _update_course_content_rag_status(
            course_content_id=course_content_id,
            rag_status="failed",
            rag_chunk_count=0,
            rag_error=str(exc),
        )


def _chunk_parsed_text_units(units: list[ParsedTextUnit]) -> list[TextChunk]:
    normalized_parts: list[str] = []
    unit_spans: list[dict[str, int | str]] = []
    cursor = 0

    for unit in units:
        normalized_text = " ".join(unit.text.split())
        if not normalized_text:
            continue

        if normalized_parts:
            cursor += 1

        start_char = cursor
        end_char = start_char + len(normalized_text)
        normalized_parts.append(normalized_text)
        unit_spans.append(
            {
                "start_char": start_char,
                "end_char": end_char,
                "location_kind": unit.location_kind,
                "location_start": unit.location_start,
                "location_end": unit.location_end,
            }
        )
        cursor = end_char

    if not normalized_parts:
        return []

    raw_chunks = chunk_text(" ".join(normalized_parts))
    chunks: list[TextChunk] = []

    for raw_chunk in raw_chunks:
        overlapping_spans = [
            unit_span
            for unit_span in unit_spans
            if int(unit_span["start_char"]) < raw_chunk.end_char
            and int(unit_span["end_char"]) > raw_chunk.start_char
        ]
        location_kind = (
            str(overlapping_spans[0]["location_kind"]) if overlapping_spans else None
        )
        location_start = min(
            int(unit_span["location_start"]) for unit_span in overlapping_spans
        ) if overlapping_spans else None
        location_end = max(
            int(unit_span["location_end"]) for unit_span in overlapping_spans
        ) if overlapping_spans else None

        chunks.append(
            TextChunk(
                index=len(chunks),
                text=raw_chunk.text,
                start_char=raw_chunk.start_char,
                end_char=raw_chunk.end_char,
                location_kind=location_kind,
                location_start=location_start,
                location_end=location_end,
            )
        )

    return chunks


def get_course_content_preview(*, course_content_id: int) -> CourseContentPreviewManifest:
    manifest = _download_preview_manifest(
        course_content_id=course_content_id,
    )
    if manifest:
        logger.info(
            "Preview GET source=manifest course_content_id=%s",
            course_content_id,
        )
        return manifest.model_copy(update={"preview_count": len(manifest.items)})

    row = db.fetch_one("SELECT * FROM public.course_contents WHERE id = %s", (course_content_id,))
    if row:
        logger.info(
            "Preview GET source=db course_content_id=%s",
            course_content_id,
        )
        record = CourseContentRecord.model_validate(row)
        preview_error = row.get("preview_error")
        return CourseContentPreviewManifest(
            course_content_id=record.id,
            material_name=record.material_name,
            source_type=record.source_type or _detect_source_type(record.material_name),
            preview_status=record.preview_status,
            preview_count=record.preview_count,
            access_url=record.access_url,
            preview_error=preview_error if isinstance(preview_error, str) else None,
            items=[],
        )

    logger.info(
        "Preview GET source=not-found course_content_id=%s",
        course_content_id,
    )
    raise PreviewNotFoundError(
        f"Course content {course_content_id} was not found."
    )


def get_course_content_preview_for_user(
    *,
    access_token: str,
    course_content_id: int,
) -> CourseContentPreviewManifest:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    return get_course_content_preview(course_content_id=course_content_id)


def get_course_content_file_for_user(
    *,
    access_token: str,
    course_content_id: int,
) -> CourseContentFileResponse:
    auth_user = _resolve_authenticated_user(access_token=access_token)
    row = db.fetch_one(
        """
        SELECT material.id, material.material_name, material.access_url, material.source_type
        FROM public.course_contents AS material
        WHERE material.id = %s
          AND EXISTS (
              SELECT 1
              FROM public.project_materials AS link
              JOIN public.projects AS project ON project.id = link.project_id
              WHERE link.material_id = material.id AND project.owner_user_id = %s
          )
        """,
        (course_content_id, auth_user.user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Course content was not found.")

    storage_path = _extract_storage_path_from_access_url(access_url=row.get("access_url") or "")
    if not storage_path:
        raise InvalidStorageLocationError("Stored file URL is not in the configured storage bucket.")

    stored_object = storage_service.head_object_optional(key=storage_path)
    if stored_object is None:
        raise StoredFileMissingError(
            f"The original file for {row['material_name']} is missing from storage. Upload it again."
        )

    source_type = row.get("source_type")
    if source_type is None:
        try:
            source_type = _detect_source_type(row["material_name"])
        except DataServiceError:
            source_type = None

    content_length = stored_object.get("content_length")
    return CourseContentFileResponse(
        course_content_id=row["id"],
        material_name=row["material_name"],
        source_type=source_type,
        # Rebuilt from the key so rows still holding legacy Supabase URLs resolve to current storage.
        url=_build_object_url(storage_path=storage_path),
        content_type=stored_object.get("content_type") or mimetypes.guess_type(row["material_name"])[0],
        size=content_length if isinstance(content_length, int) else None,
    )


def update_course_content_name_for_user(
    *,
    access_token: str,
    course_content_id: int,
    material_name: str,
) -> CourseContentRecord:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    record = _fetch_course_content_record(
        course_content_id=course_content_id,
    )
    next_material_name = _normalize_locked_material_name(
        requested_name=material_name,
        current_name=record.material_name,
    )

    if next_material_name != record.material_name:
        record = _update_course_content_record_name(
            course_content_id=course_content_id,
            material_name=next_material_name,
        )

    source_type = record.source_type or _detect_source_type(record.material_name)
    preview_metadata = _refresh_course_content_preview_metadata(
        course_content_id=record.id,
        material_name=record.material_name,
        access_url=record.access_url,
        source_type=source_type,
        fallback_preview_status=record.preview_status,
        fallback_preview_count=record.preview_count,
    )

    return record.model_copy(update=preview_metadata)


def delete_course_content_for_user(
    *,
    access_token: str,
    course_content_id: int,
) -> None:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    record = _fetch_course_content_record_optional(
        course_content_id=course_content_id,
    )
    if record is None:
        raise ProjectNotFoundError("Course content was not found.")

    material_links = _fetch_project_material_links_for_material(
        material_id=course_content_id,
    )
    for link in material_links:
        project_id = _read_optional_int(link, "project_id")
        if project_id is None:
            continue

        cleanup_error = _delete_project_material_link(
            project_id=project_id,
            material_id=course_content_id,
        )
        if cleanup_error:
            raise DataServiceError(cleanup_error)

    _delete_course_content_preview_assets(
        course_content_id=course_content_id,
    )
    chunk_delete_error = _delete_course_content_chunks(
        course_content_id=course_content_id,
    )
    if chunk_delete_error:
        raise DataServiceError(chunk_delete_error)

    source_storage_path = _extract_storage_path_from_access_url(
        access_url=record.access_url,
    )
    if source_storage_path:
        source_delete_error = _delete_storage_object_if_exists(
            storage_path=source_storage_path,
        )
        if source_delete_error:
            raise DataServiceError(source_delete_error)

    delete_error = _delete_course_content_record(
        course_content_id=course_content_id,
    )
    if delete_error:
        raise DataServiceError(delete_error)


def get_course_content_texts_for_user(
    *,
    access_token: str,
    project_uuid: str | None = None,
    material_ids: list[int],
) -> list[QuizSourceMaterial]:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    unique_material_ids = list(dict.fromkeys(material_ids))
    normalized_project_uuid = (project_uuid or "").strip()

    if normalized_project_uuid:
        project_row = _fetch_owned_project_row_by_uuid(
            project_uuid=normalized_project_uuid,
            owner_user_id=auth_user.user_id,
        )
        project_id = _read_int(project_row, "id")
        _assert_materials_linked_to_project(
            project_id=project_id,
            material_ids=unique_material_ids,
        )

    for material_id in unique_material_ids:
        _assert_course_content_owned_by_username(
            course_content_id=material_id,
            owner_user_id=auth_user.user_id,
        )

    records_by_id = _fetch_course_content_records_by_id(
        material_ids=unique_material_ids,
    )
    source_materials: list[QuizSourceMaterial] = []
    parse_errors: list[str] = []

    for material_id in unique_material_ids:
        record_payload = records_by_id.get(material_id)
        if not record_payload:
            raise ProjectNotFoundError("Course content was not found.")

        record = CourseContentRecord.model_validate(record_payload)
        source_type = record.source_type or _detect_source_type(record.material_name)
        file_bytes = _download_object_by_url(record.access_url)

        try:
            text = parse_document(file_bytes=file_bytes, file_type=source_type)
        except DocumentParseError as exc:
            message = f"{record.material_name}: {exc}"
            parse_errors.append(message)
            logger.warning(
                "Skipping unreadable quiz source material_id=%s filename=%s: %s",
                record.id,
                record.material_name,
                exc,
            )
            continue

        logger.info(
            "Parsed quiz source material_id=%s filename=%s chars_extracted=%s",
            record.id,
            record.material_name,
            len(text),
        )

        source_materials.append(
            QuizSourceMaterial(
                id=record.id,
                name=record.material_name,
                text=text,
            )
        )

    if not source_materials:
        detail = " | ".join(parse_errors) if parse_errors else "No source text could be extracted."
        raise DataServiceError(f"Unable to read selected sources for quiz generation: {detail}")

    return source_materials


def answer_project_question_for_user(
    *,
    access_token: str,
    project_uuid: str,
    message: str,
    selected_material_id: int | None = None,
    selected_material_ids: list[int] | None = None,
) -> ProjectChatResponse:
    project = get_project_for_user(access_token=access_token, project_uuid=project_uuid)
    if project.id is None:
        raise DataServiceError("Project record is missing a numeric id.")
    if not project.materials:
        raise ProjectNotFoundError("No course materials were found for this project.")

    history = _fetch_project_chat_messages(
        project_id=project.id,
        owner_user_id=project.owner_user_id,
    )
    normalized_selected_material_ids = _normalize_selected_material_ids(
        selected_material_id=selected_material_id,
        selected_material_ids=selected_material_ids,
    )
    selected_materials = []
    if normalized_selected_material_ids:
        material_by_id = {
            material.id: material
            for material in project.materials
            if material.id is not None
        }
        selected_materials = [
            material_by_id[material_id]
            for material_id in normalized_selected_material_ids
            if material_id in material_by_id
        ]
        if len(selected_materials) != len(normalized_selected_material_ids):
            raise ProjectNotFoundError("One or more selected sources were not found in this project.")

    query_embedding = embed_text(message)
    retrieved_chunks = _match_course_content_chunks_for_selection(
        project_id=project.id,
        query_embedding=query_embedding,
        selected_material_ids=normalized_selected_material_ids,
        match_count=8,
    )
    selection_mode = "rag_selected" if normalized_selected_material_ids else "rag"

    if not retrieved_chunks:
        sources = [
            ProjectChatSourceRecord(id=material.id, material_name=material.material_name)
            for material in selected_materials
        ] if selected_materials else []
        answer = (
            "I could not find any ready indexed content for that source yet. "
            "Try again after upload indexing finishes, or upload a readable PDF, DOCX, or PPTX file."
        )
        messages = _append_project_chat_exchange(
            project_id=project.id,
            owner_user_id=project.owner_user_id,
            user_content=message,
            assistant_content=answer,
            sources=sources,
            selection_mode="rag_unavailable",
        )
        return ProjectChatResponse(
            answer=answer,
            selection_mode="rag_unavailable",
            sources=sources,
            messages=messages,
        )

    sources = _build_rag_source_records(retrieved_chunks)
    answer = generate_project_chat_answer(
        question=message,
        history=history,
        materials=[
            QuizSourceMaterial(
                id=chunk.course_content_id,
                name=_format_rag_source_name(chunk),
                text=chunk.text,
            )
            for chunk in retrieved_chunks
        ],
    )
    messages = _append_project_chat_exchange(
        project_id=project.id,
        owner_user_id=project.owner_user_id,
        user_content=message,
        assistant_content=answer,
        sources=sources,
        selection_mode=selection_mode,
    )

    return ProjectChatResponse(
        answer=answer,
        selection_mode=selection_mode,
        sources=sources,
        messages=messages,
    )


def get_project_chat_history_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> ProjectChatHistoryResponse:
    auth_user = _resolve_authenticated_user(access_token=access_token)
    if not _is_uuid(project_uuid):
        raise ProjectNotFoundError("Project was not found.")

    row = db.fetch_one(
        """
        SELECT memory.messages
        FROM public.projects AS project
        LEFT JOIN public.project_chat_memory AS memory
            ON memory.project_id = project.id AND memory.owner_user_id = project.owner_user_id
        WHERE project.project_uuid = %s::uuid AND project.owner_user_id = %s
        """,
        (project_uuid, auth_user.user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    messages = row.get("messages")
    return ProjectChatHistoryResponse(
        messages=_validate_project_chat_messages(messages) if messages is not None else [],
    )


def clear_project_chat_history_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> None:
    auth_user = _resolve_authenticated_user(access_token=access_token)
    project_row = _fetch_owned_project_row_by_uuid(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )

    _delete_project_chat_memory(
        project_id=_read_int(project_row, "id"),
        owner_user_id=auth_user.user_id,
    )


def _fetch_project_chat_messages(
    *,
    project_id: int,
    owner_user_id: str,
) -> list[ProjectChatMessageRecord]:
    row = db.fetch_one(
        """
        SELECT messages
        FROM public.project_chat_memory
        WHERE project_id = %s AND owner_user_id = %s
        """,
        (project_id, owner_user_id),
    )
    if row is None:
        return []

    return _validate_project_chat_messages(row.get("messages"))


def _append_project_chat_exchange(
    *,
    project_id: int,
    owner_user_id: str,
    user_content: str,
    assistant_content: str,
    sources: list[ProjectChatSourceRecord],
    selection_mode: Literal[
        "selected",
        "title_match",
        "fallback",
        "rag",
        "rag_selected",
        "rag_unavailable",
    ],
) -> list[ProjectChatMessageRecord]:
    timestamp = datetime.now(timezone.utc).isoformat()
    user_message = {
        "id": str(uuid4()),
        "role": "user",
        "content": user_content,
        "timestamp": timestamp,
        "sources": [],
        "selection_mode": None,
    }
    assistant_message = {
        "id": str(uuid4()),
        "role": "assistant",
        "content": assistant_content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sources": [source.model_dump(mode="json") for source in sources],
        "selection_mode": selection_mode,
    }
    row = db.fetch_one(
        "SELECT public.append_project_chat_exchange(%s, %s, %s::jsonb, %s::jsonb) AS messages",
        (project_id, owner_user_id, db.json_param(user_message), db.json_param(assistant_message)),
    )
    return _validate_project_chat_messages(row.get("messages") if row else None)


def _delete_project_chat_memory(
    *,
    project_id: int,
    owner_user_id: str,
) -> None:
    db.execute(
        "DELETE FROM public.project_chat_memory WHERE project_id = %s AND owner_user_id = %s",
        (project_id, owner_user_id),
    )


def _validate_project_chat_messages(raw_messages: Any) -> list[ProjectChatMessageRecord]:
    if not isinstance(raw_messages, list):
        raise DataServiceError("Project chat memory returned an invalid message list.")

    try:
        messages = [
            ProjectChatMessageRecord.model_validate(message)
            for message in raw_messages[-CHAT_MEMORY_LIMIT:]
        ]
    except ValidationError as exc:
        raise DataServiceError("Project chat memory contains an invalid message.") from exc

    return messages


def list_generated_materials_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> list[GeneratedMaterialRecord]:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    rows = _fetch_owned_generated_material_rows(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    return [GeneratedMaterialRecord.model_validate(row) for row in rows]


def _select_chat_source_materials(
    *,
    project_materials: list[ProjectMaterialRecord],
    message: str,
    selected_material_id: int | None,
) -> tuple[list[ProjectMaterialRecord], str]:
    if not project_materials:
        return [], "fallback"

    if selected_material_id is not None:
        for material in project_materials:
            if material.id == selected_material_id:
                return [material], "selected"

        raise ProjectNotFoundError("Selected source was not found in this project.")

    query_tokens = _tokenize_chat_query(message)
    scored_materials: list[tuple[int, ProjectMaterialRecord]] = []

    for material in project_materials:
        score = _score_chat_material_title(material.material_name, query_tokens)
        if score > 0:
            scored_materials.append((score, material))

    if scored_materials:
        scored_materials.sort(key=lambda item: (-item[0], item[1].id))
        return [material for _, material in scored_materials[:3]], "title_match"

    return [project_materials[0]], "fallback"


def _score_chat_material_title(title: str, query_tokens: set[str]) -> int:
    normalized_title = _normalize_chat_text(title)
    if not normalized_title:
        return 0

    score = 0
    title_tokens = set(_tokenize_chat_query(title))

    if title_tokens & query_tokens:
        score += len(title_tokens & query_tokens) * 2

    for token in query_tokens:
        if token in normalized_title:
            score += 1

    if normalized_title in query_tokens:
        score += 3

    return score


def _tokenize_chat_query(text: str) -> set[str]:
    normalized_text = _normalize_chat_text(text)
    if not normalized_text:
        return set()

    tokens = {
        token
        for token in normalized_text.split()
        if len(token) >= 3 and token not in {"the", "and", "for", "with", "from", "this", "that", "what", "how", "why", "when", "where"}
    }
    return tokens


def _normalize_chat_text(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def list_generated_quiz_history_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> list[GeneratedQuizHistoryRecord]:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    normalized_project_uuid = project_uuid
    rows = _fetch_owned_generated_material_rows(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
        tool_type="quiz",
    )

    quiz_history: list[GeneratedQuizHistoryRecord] = []
    for row in rows:
        row_id = _read_optional_int(row, "id")
        if row_id is None:
            logger.warning(
                "Skipping generated quiz row missing id project_uuid=%s",
                normalized_project_uuid,
            )
            continue

        payload = row.get("payload")
        if not isinstance(payload, dict):
            logger.warning(
                "Skipping generated quiz row id=%s due to non-object payload",
                row_id,
            )
            continue

        try:
            quiz = GeneratedQuiz.model_validate(payload)
            quiz_history.append(
                GeneratedQuizHistoryRecord(
                    id=row_id,
                    created_at=row.get("created_at"),
                    quiz=quiz,
                )
            )
        except ValidationError as exc:
            logger.warning(
                "Skipping generated quiz row id=%s due to payload validation error: %s",
                row_id,
                exc,
            )

    return quiz_history


def generate_quiz_for_user(
    *,
    access_token: str,
    project_uuid: str,
    material_ids: list[int],
    question_count: int,
) -> GeneratedQuiz:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)
    project_id = _read_int(owned_project, "id")
    unique_material_ids = list(dict.fromkeys(material_ids))
    _assert_material_ids_linked_to_project(
        project_id=project_id,
        material_ids=unique_material_ids,
    )

    for material_id in unique_material_ids:
        _assert_course_content_owned_by_username(
            course_content_id=material_id,
            owner_user_id=auth_user.user_id,
        )
    materials = get_course_content_texts_for_user(
        access_token=access_token,
        material_ids=unique_material_ids,
    )
    generation_result = generate_quiz_with_usage(
        materials=materials,
        question_count=question_count,
    )

    _insert_generated_material_record(
        project_uuid=normalized_project["project_uuid"],
        name=generation_result.quiz.title,
        file_location="inline://payload",
        tool_type="quiz",
        source_material_ids=unique_material_ids,
        payload={
            **generation_result.quiz.model_dump(),
            "token_source": generation_result.token_usage.source,
        },
        input_token=generation_result.token_usage.input_token,
        output_token=generation_result.token_usage.output_token,
    )
    return generation_result.quiz


def generate_slide_deck_for_user(
    *,
    access_token: str,
    project_uuid: str,
    material_ids: list[int],
    slide_count: int,
) -> GeneratedMaterialRecord:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)
    project_id = _read_int(owned_project, "id")
    unique_material_ids = list(dict.fromkeys(material_ids))
    _assert_material_ids_linked_to_project(
        project_id=project_id,
        material_ids=unique_material_ids,
    )

    materials = get_course_content_texts_for_user(
        access_token=access_token,
        material_ids=unique_material_ids,
    )

    generation_result = generate_slide_deck_outline_with_usage(
        materials=materials,
        slide_count=slide_count,
    )
    deck_bytes = build_slide_deck_pptx_bytes(outline=generation_result.outline)

    generated_uuid = str(uuid4())
    safe_title = sanitize_filename(
        generation_result.outline.title,
        fallback_name="generated-slide-deck",
    )
    storage_filename = f"{safe_title}.pptx"
    storage_path = _build_generated_material_storage_path(
        project_uuid=normalized_project["project_uuid"],
        generated_material_uuid=generated_uuid,
        filename=storage_filename,
    )
    _upload_or_replace_storage_object(
        storage_path=storage_path,
        file_bytes=deck_bytes,
        content_type=PPTX_CONTENT_TYPE,
    )
    file_location = _build_object_url(
        storage_path=storage_path,
    )
    preview_result = _build_generated_slide_deck_preview(
        project_uuid=normalized_project["project_uuid"],
        generated_material_uuid=generated_uuid,
        deck_filename=storage_filename,
        deck_bytes=deck_bytes,
    )

    try:
        return _insert_generated_material_record(
            uuid=generated_uuid,
            project_uuid=normalized_project["project_uuid"],
            name=generation_result.outline.title,
            file_location=file_location,
            tool_type="slide_deck",
            source_material_ids=unique_material_ids,
            payload={
                "outline": generation_result.outline.model_dump(),
                "token_source": generation_result.token_usage.source,
                "preview": preview_result.payload,
            },
            input_token=generation_result.token_usage.input_token,
            output_token=generation_result.token_usage.output_token,
        )
    except DataServiceError as exc:
        cleanup_errors: list[str] = []
        cleanup_paths = [storage_path, *preview_result.storage_paths]
        for cleanup_path in cleanup_paths:
            cleanup_error = _delete_storage_object_if_exists(
                storage_path=cleanup_path,
            )
            if cleanup_error:
                cleanup_errors.append(cleanup_error)
        if cleanup_errors:
            raise DataServiceError(f"{exc} Cleanup failed: {' | '.join(cleanup_errors)}") from exc
        raise


def get_generated_material_download_for_user(
    *,
    access_token: str,
    project_uuid: str,
    generated_material_uuid: str,
    download_format: Literal["pptx", "pdf"] = "pptx",
) -> tuple[str, str]:
    auth_user = _resolve_authenticated_user(
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)

    row = _fetch_generated_material_row_by_uuid_for_project(
        project_uuid=normalized_project["project_uuid"],
        generated_material_uuid=generated_material_uuid,
    )
    record = GeneratedMaterialRecord.model_validate(row)

    if record.file_location.startswith("inline://"):
        raise DataServiceError("This generated material does not include a downloadable file.")

    base_filename = sanitize_filename(
        (record.name or f"generated-{record.tool_type}").strip(),
        fallback_name=f"generated-{record.tool_type}",
    )

    if download_format == "pdf":
        if record.tool_type != "slide_deck":
            raise DataServiceError("PDF download is only available for generated slide decks.")

        pdf_filename = _ensure_file_extension(base_filename=base_filename, extension="pdf")
        pdf_storage_path = _build_generated_material_storage_path(
            project_uuid=normalized_project["project_uuid"],
            generated_material_uuid=record.uuid,
            filename=pdf_filename,
        )
        cached_pdf = _download_storage_object_optional(
            storage_path=pdf_storage_path,
        )

        if cached_pdf is None:
            source_pptx_storage_path = _extract_storage_path_from_access_url(
                access_url=record.file_location,
            )
            source_pptx_bytes: bytes | None = None

            if source_pptx_storage_path:
                source_pptx_bytes = _download_storage_object_optional(
                    storage_path=source_pptx_storage_path,
                )

            if source_pptx_bytes is None:
                source_pptx_bytes = _download_object_by_url(record.file_location)

            source_pptx_name = _ensure_file_extension(base_filename=base_filename, extension="pptx")
            converted_pdf = convert_pptx_to_pdf_bytes(
                filename=source_pptx_name,
                file_bytes=source_pptx_bytes,
            )
            _upload_or_replace_storage_object(
                storage_path=pdf_storage_path,
                file_bytes=converted_pdf,
                content_type=PDF_CONTENT_TYPE,
            )

        return _build_object_url(
            storage_path=pdf_storage_path,
        ), pdf_filename

    filename = _ensure_file_extension(base_filename=base_filename, extension="pptx")

    return record.file_location, filename


def _build_storage_path(filename: str) -> str:
    sanitized_filename = sanitize_filename(filename)
    return f"course-contents/{uuid4()}/{sanitized_filename}"


def _compute_content_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def _format_vector(values: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in values) + "]"


def _build_generated_material_storage_path(
    *,
    project_uuid: str,
    generated_material_uuid: str,
    filename: str,
) -> str:
    safe_filename = sanitize_filename(filename, fallback_name="generated-slide-deck.pptx")
    return (
        f"{GENERATED_MATERIALS_STORAGE_PREFIX}/"
        f"{project_uuid}/{generated_material_uuid}/{safe_filename}"
    )


def _build_generated_material_preview_storage_path(
    *,
    project_uuid: str,
    generated_material_uuid: str,
    image_name: str,
) -> str:
    safe_image_name = sanitize_filename(image_name, fallback_name="slide-preview.png")
    return (
        f"{GENERATED_MATERIALS_STORAGE_PREFIX}/"
        f"{project_uuid}/{generated_material_uuid}/preview/{safe_image_name}"
    )


def _ensure_file_extension(*, base_filename: str, extension: str) -> str:
    normalized_base = base_filename.strip()
    if not normalized_base:
        normalized_base = "generated-material"

    root, _ = os.path.splitext(normalized_base)
    normalized_root = root.strip() if root.strip() else normalized_base
    return f"{normalized_root}.{extension.lower()}"


def _build_generated_slide_deck_preview(
    *,
    project_uuid: str,
    generated_material_uuid: str,
    deck_filename: str,
    deck_bytes: bytes,
) -> SlideDeckPreviewBuildResult:
    uploaded_preview_paths: list[str] = []

    try:
        _, rendered_items = render_course_content_previews(
            filename=deck_filename,
            file_bytes=deck_bytes,
        )
        preview_items: list[dict[str, Any]] = []

        for item in rendered_items:
            preview_storage_path = _build_generated_material_preview_storage_path(
                project_uuid=project_uuid,
                generated_material_uuid=generated_material_uuid,
                image_name=item.image_name,
            )
            _upload_or_replace_storage_object(
                storage_path=preview_storage_path,
                file_bytes=item.image_bytes,
                content_type="image/png",
            )
            uploaded_preview_paths.append(preview_storage_path)
            preview_items.append(
                {
                    "id": f"{generated_material_uuid}-{item.index}",
                    "index": item.index,
                    "label": item.label,
                    "title": item.title,
                    "subtitle": item.subtitle,
                    "image_url": _build_object_url(
                        storage_path=preview_storage_path,
                    ),
                    "width": item.width,
                    "height": item.height,
                }
            )
    except (DocumentPreviewError, DataServiceError) as exc:
        cleanup_errors: list[str] = []
        for uploaded_path in uploaded_preview_paths:
            cleanup_error = _delete_storage_object_if_exists(
                storage_path=uploaded_path,
            )
            if cleanup_error:
                cleanup_errors.append(cleanup_error)

        logger.warning(
            "Generated slide preview failed for generated_material_uuid=%s: %s",
            generated_material_uuid,
            exc,
        )
        if cleanup_errors:
            logger.warning(
                "Generated slide preview cleanup failed for generated_material_uuid=%s: %s",
                generated_material_uuid,
                " | ".join(cleanup_errors),
            )
        return SlideDeckPreviewBuildResult(
            payload={
                "status": "failed",
                "error": str(exc),
                "items": [],
            },
            storage_paths=[],
        )

    return SlideDeckPreviewBuildResult(
        payload={
            "status": "ready",
            "error": None,
            "items": preview_items,
        },
        storage_paths=uploaded_preview_paths,
    )


def _build_preview_manifest_storage_path(*, course_content_id: int) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/manifest.json"


def _build_preview_status_storage_path(*, course_content_id: int) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/status.json"


def _build_preview_item_storage_path(*, course_content_id: int, image_name: str) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/{image_name}"


def _normalize_locked_material_name(*, requested_name: str, current_name: str) -> str:
    normalized_requested_name = requested_name.strip()
    requested_base_name = os.path.splitext(normalized_requested_name)[0].strip()
    if not requested_base_name:
        raise DataServiceError("Source name cannot be empty.")

    current_suffix = os.path.splitext(current_name)[1].lower()
    if not current_suffix:
        raise DataServiceError("Source filename is missing an extension.")
    _detect_source_type(f"placeholder{current_suffix}")

    sanitized_base_name = sanitize_filename(requested_base_name, fallback_name="material")
    normalized_base_name = os.path.splitext(sanitized_base_name)[0].strip("._-")
    if not normalized_base_name:
        normalized_base_name = "material"

    return f"{normalized_base_name}{current_suffix}"


def _refresh_course_content_preview_metadata(
    *,
    course_content_id: int,
    material_name: str,
    access_url: str,
    source_type: SourceType,
    fallback_preview_status: PreviewStatus,
    fallback_preview_count: int,
) -> dict[str, Any]:
    preview_status_payload = _download_preview_status(
        course_content_id=course_content_id,
    )
    preview_manifest = _download_preview_manifest(
        course_content_id=course_content_id,
    )

    preview_status: PreviewStatus = fallback_preview_status
    raw_preview_status = preview_status_payload.get("preview_status")
    if raw_preview_status in {"pending", "ready", "failed"}:
        preview_status = raw_preview_status

    preview_count = fallback_preview_count
    raw_preview_count = preview_status_payload.get("preview_count")
    if isinstance(raw_preview_count, int):
        preview_count = raw_preview_count

    preview_error = preview_status_payload.get("preview_error")
    if not isinstance(preview_error, str):
        preview_error = None

    if preview_status_payload or preview_manifest:
        current_access_url = preview_status_payload.get("access_url")
        if not isinstance(current_access_url, str) or not current_access_url.strip():
            current_access_url = access_url

        _upload_preview_status(
            course_content_id=course_content_id,
            material_name=material_name,
            access_url=current_access_url,
            source_type=source_type,
            preview_status=preview_status,
            preview_count=preview_count,
            preview_error=preview_error,
        )

    if preview_manifest:
        _upload_preview_manifest(
            course_content_id=course_content_id,
            manifest=preview_manifest.model_copy(update={"material_name": material_name}),
        )

    return {
        "preview_status": preview_status,
        "preview_count": preview_count,
    }


def _delete_course_content_preview_assets(
    *,
    course_content_id: int,
) -> None:
    preview_manifest = _download_preview_manifest(
        course_content_id=course_content_id,
    )

    preview_storage_paths = {
        _build_preview_manifest_storage_path(course_content_id=course_content_id),
        _build_preview_status_storage_path(course_content_id=course_content_id),
    }

    if preview_manifest:
        for item in preview_manifest.items:
            preview_item_storage_path = _extract_storage_path_from_access_url(
                access_url=item.image_url,
            )
            if preview_item_storage_path:
                preview_storage_paths.add(preview_item_storage_path)

    for storage_path in sorted(preview_storage_paths):
        cleanup_error = _delete_storage_object_if_exists(
            storage_path=storage_path,
        )
        if cleanup_error:
            raise DataServiceError(cleanup_error)


def _insert_user_profile(
    *,
    username: str,
    profession: str,
    user_uuid: str,
) -> UserProfileRecord:
    row = db.fetch_one(
        """
        INSERT INTO public.users (username, profession, user_uuid)
        VALUES (%s, %s, %s::uuid)
        RETURNING *
        """,
        (username, profession, user_uuid),
    )
    if row is None:
        raise DataServiceError("Database did not return the inserted users row.")

    return UserProfileRecord.model_validate(row)


def _resolve_authenticated_user(
    *,
    access_token: str,
) -> AuthenticatedUser:
    auth_user = auth_service.resolve_token(access_token)
    metadata_username = auth_user.user_metadata.get("username")
    profession = auth_user.user_metadata.get("profession")

    return AuthenticatedUser(
        user_id=auth_user.id,
        session_id=auth_user.session_id or "",
        email=auth_user.email,
        username=metadata_username.strip() if isinstance(metadata_username, str) else "",
        profession=profession.strip() if isinstance(profession, str) else "",
    )


def _get_user_profile_optional(
    *,
    auth_user: AuthenticatedUser,
) -> UserProfileRecord | None:
    if not auth_user.username:
        return None

    profile = _fetch_user_profile_by_username(
        username=auth_user.username,
    )
    if profile:
        return profile

    if auth_user.profession not in {"student", "professor"}:
        return None

    return _insert_user_profile(
        username=auth_user.username,
        profession=auth_user.profession,
        user_uuid=auth_user.user_id,
    )


def _fetch_user_profile_by_username(
    *,
    username: str,
) -> UserProfileRecord | None:
    row = db.fetch_one("SELECT * FROM public.users WHERE username = %s", (username,))
    if row is None:
        return None

    return UserProfileRecord.model_validate(row)


def _fetch_project_rows_for_owner(
    *,
    owner_user_id: str,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    return db.fetch_all(
        """
        SELECT project.*, links.material_count, links.last_updated
        FROM public.projects AS project
        CROSS JOIN LATERAL (
            SELECT count(*)::int AS material_count, max(link.created_at) AS last_updated
            FROM public.project_materials AS link
            WHERE link.project_id = project.id
        ) AS links
        WHERE project.owner_user_id = %s
        ORDER BY project.created_at DESC NULLS LAST, project.id DESC
        LIMIT %s
        """,
        (owner_user_id, limit if isinstance(limit, int) and limit > 0 else None),
    )


def _fetch_owned_project_detail_row(
    *,
    project_uuid: str,
    owner_user_id: str,
) -> dict[str, Any]:
    """Project row plus its materials (newest link first) in one round trip."""
    if not _is_uuid(project_uuid):
        raise ProjectNotFoundError("Project was not found.")

    row = db.fetch_one(
        """
        SELECT
            project.*,
            coalesce(links.materials, '[]'::jsonb) AS materials,
            coalesce(links.material_count, 0) AS material_count,
            links.last_updated
        FROM public.projects AS project
        CROSS JOIN LATERAL (
            SELECT
                jsonb_agg(
                    to_jsonb(material) || jsonb_build_object('uploaded_at', link.created_at)
                    ORDER BY link.created_at DESC
                ) AS materials,
                count(*)::int AS material_count,
                max(link.created_at) AS last_updated
            FROM public.project_materials AS link
            JOIN public.course_contents AS material ON material.id = link.material_id
            WHERE link.project_id = project.id
        ) AS links
        WHERE project.project_uuid = %s::uuid AND project.owner_user_id = %s
        """,
        (project_uuid, owner_user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    return row


def _fetch_owned_project_row(
    *,
    project_id: int,
    owner_user_id: str,
) -> dict[str, Any]:
    row = db.fetch_one(
        "SELECT * FROM public.projects WHERE id = %s AND owner_user_id = %s",
        (project_id, owner_user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    return row


def _fetch_owned_project_row_by_uuid(
    *,
    project_uuid: str,
    owner_user_id: str,
) -> dict[str, Any]:
    if not _is_uuid(project_uuid):
        raise ProjectNotFoundError("Project was not found.")

    row = db.fetch_one(
        "SELECT * FROM public.projects WHERE project_uuid = %s::uuid AND owner_user_id = %s",
        (project_uuid, owner_user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    return row


def _fetch_project_row_by_uuid(
    *,
    project_uuid: str,
) -> dict[str, Any]:
    if not _is_uuid(project_uuid):
        raise ProjectNotFoundError("Project was not found.")

    row = db.fetch_one(
        "SELECT * FROM public.projects WHERE project_uuid = %s::uuid",
        (project_uuid,),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    return row


def _insert_project_record(
    *,
    name: str,
    owner_user_id: str,
    owner_auth_user_id: str | None = None,
    created_by: str | int | None = None,
) -> dict[str, Any]:
    columns = ["name", "owner_user_id"]
    values: list[Any] = [name, owner_user_id]
    if owner_auth_user_id:
        columns.append("owner_auth_user_id")
        values.append(owner_auth_user_id)
    if created_by is not None:
        columns.append("created_by")
        values.append(str(created_by))

    placeholders = ", ".join(["%s"] * len(values))
    row = db.fetch_one(
        f"INSERT INTO public.projects ({', '.join(columns)}) VALUES ({placeholders}) RETURNING *",
        values,
    )
    if row is None:
        raise DataServiceError("Database did not return the inserted projects row.")

    return row


def _is_legacy_projects_not_null_error(error: Exception) -> bool:
    message = str(error).lower()
    if "null value in column" not in message:
        return False
    if 'relation "projects"' not in message:
        return False

    return any(f'"{column}"' in message for column in LEGACY_PROJECTS_NOT_NULL_COLUMNS)


def _build_legacy_projects_migration_hint_message(error_message: str) -> str:
    return (
        f"{error_message} "
        "Legacy projects schema constraints detected. "
        "Apply backend/database/migrations/20260502_projects_uuid_contract.sql, then "
        "backend/database/migrations/20260503_projects_legacy_not_null_relax.sql."
    )


def _update_project_record(
    *,
    project_id: int,
    name: str,
) -> dict[str, Any]:
    row = db.fetch_one(
        "UPDATE public.projects SET name = %s WHERE id = %s RETURNING *",
        (name, project_id),
    )
    if row is None:
        raise ProjectNotFoundError("Project was not found.")

    return row


def _delete_project_record(
    *,
    project_id: int,
) -> Optional[str]:
    try:
        db.execute("DELETE FROM public.projects WHERE id = %s", (project_id,))
    except DataServiceError as exc:
        return str(exc)

    return None


def _delete_user_project_links_for_project(
    *,
    project_id: int,
) -> Optional[str]:
    try:
        db.execute("DELETE FROM public.user_projects WHERE project_id = %s", (project_id,))
    except DataServiceError as exc:
        return str(exc)

    return None


def _insert_user_project_link(
    *,
    user_id: int,
    project_id: int,
) -> None:
    db.execute(
        "INSERT INTO public.user_projects (user_id, project_id) VALUES (%s, %s)",
        (user_id, project_id),
    )


def _insert_project_material_link(
    *,
    project_id: int,
    material_id: int,
) -> None:
    db.execute(
        "INSERT INTO public.project_materials (project_id, material_id) VALUES (%s, %s)",
        (project_id, material_id),
    )


def _delete_project_material_link(
    *,
    project_id: int,
    material_id: int,
) -> Optional[str]:
    try:
        db.execute(
            "DELETE FROM public.project_materials WHERE project_id = %s AND material_id = %s",
            (project_id, material_id),
        )
    except DataServiceError as exc:
        return str(exc)

    return None


def _build_project_summary(
    *,
    project_row: dict[str, Any],
) -> ProjectSummary:
    """Build a summary from a projects row that may carry precomputed link aggregates.

    Rows from ``_fetch_project_rows_for_owner``/``_fetch_owned_project_detail_row`` include
    ``material_count``/``last_updated``; a freshly inserted project has no links yet.
    """
    material_count = project_row.get("material_count")
    return ProjectSummary.model_validate(
        {
            **_normalize_project_row(project_row),
            "material_count": material_count if isinstance(material_count, int) else 0,
            "last_updated": project_row.get("last_updated"),
        }
    )


def _build_project_record(
    *,
    project_row: dict[str, Any],
) -> ProjectRecord:
    summary = _build_project_summary(project_row=project_row)
    if summary.id is None:
        raise DataServiceError("Project record is missing a numeric id.")

    raw_materials = project_row.get("materials")
    materials = [
        _build_project_material_record(material)
        for material in (raw_materials if isinstance(raw_materials, list) else [])
    ]

    return ProjectRecord.model_validate(
        {
            **summary.model_dump(),
            "materials": materials,
        }
    )


def _build_project_material_record(material: dict[str, Any]) -> ProjectMaterialRecord:
    record = ProjectMaterialRecord.model_validate(material)
    if record.source_type is None:
        # Rows created before source_type was stored; derive it from the file name.
        try:
            record = record.model_copy(update={"source_type": _detect_source_type(record.material_name)})
        except DataServiceError:
            pass

    return record


def _normalize_project_row(project_row: dict[str, Any]) -> dict[str, Any]:
    project_uuid = project_row.get("project_uuid")
    owner_user_id = project_row.get("owner_user_id")
    created_at = project_row.get("created_at")
    updated_at = project_row.get("updated_at")

    if not isinstance(project_uuid, str) or not project_uuid.strip():
        raise DataServiceError("Project row is missing a project_uuid.")
    if not isinstance(owner_user_id, str) or not owner_user_id.strip():
        raise DataServiceError("Project row is missing an owner_user_id.")

    return {
        "id": _read_optional_int(project_row, "id"),
        "project_uuid": project_uuid,
        "name": project_row.get("name") or "Untitled Project",
        "owner_user_id": owner_user_id,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _fetch_project_material_links(
    *,
    project_id: int,
) -> list[dict[str, Any]]:
    return db.fetch_all(
        """
        SELECT created_at, material_id
        FROM public.project_materials
        WHERE project_id = %s
        ORDER BY created_at DESC
        """,
        (project_id,),
    )


def _fetch_project_material_links_for_material(
    *,
    material_id: int,
) -> list[dict[str, Any]]:
    return db.fetch_all(
        "SELECT project_id, material_id FROM public.project_materials WHERE material_id = %s",
        (material_id,),
    )


def _fetch_duplicate_course_content_for_project(
    *,
    project_id: int,
    content_sha256: str,
) -> CourseContentRecord | None:
    material_links = _fetch_project_material_links(
        project_id=project_id,
    )
    material_ids = [
        material_id
        for material_id in (_read_optional_int(link, "material_id") for link in material_links)
        if material_id is not None
    ]
    if not material_ids:
        return None

    records_by_id = _fetch_course_content_records_by_id(
        material_ids=material_ids,
    )
    for material_id in material_ids:
        record_payload = records_by_id.get(material_id)
        if not record_payload:
            continue

        record = CourseContentRecord.model_validate(record_payload)
        if record.content_sha256 == content_sha256:
            return record

    return None


def _assert_material_ids_linked_to_project(
    *,
    project_id: int,
    material_ids: list[int],
) -> None:
    project_material_links = _fetch_project_material_links(
        project_id=project_id,
    )
    linked_material_ids = {
        material_id
        for material_id in (
            _read_optional_int(link, "material_id") for link in project_material_links
        )
        if material_id is not None
    }

    missing_material_ids = [
        material_id for material_id in material_ids if material_id not in linked_material_ids
    ]
    if missing_material_ids:
        raise ProjectNotFoundError("One or more selected sources are not part of this project.")


def _assert_course_content_owned_by_username(
    *,
    course_content_id: int,
    owner_user_id: str,
) -> None:
    row = db.fetch_one(
        """
        SELECT 1
        FROM public.project_materials AS link
        JOIN public.projects AS project ON project.id = link.project_id
        WHERE link.material_id = %s AND project.owner_user_id = %s
        LIMIT 1
        """,
        (course_content_id, owner_user_id),
    )
    if row is None:
        raise ProjectNotFoundError("Course content was not found.")


def _assert_materials_linked_to_project(
    *,
    project_id: int,
    material_ids: list[int],
) -> None:
    project_material_links = _fetch_project_material_links(
        project_id=project_id,
    )
    project_material_ids = {
        material_id
        for material_id in (
            _read_optional_int(project_material_link, "material_id")
            for project_material_link in project_material_links
        )
        if material_id is not None
    }
    missing_material_ids = [
        material_id for material_id in material_ids if material_id not in project_material_ids
    ]
    if missing_material_ids:
        raise ProjectAccessDeniedError(
            "One or more selected sources are not part of this project."
        )


def _fetch_course_content_records_by_id(
    *,
    material_ids: list[int],
) -> dict[int, dict[str, Any]]:
    if not material_ids:
        return {}

    rows = db.fetch_all(
        "SELECT * FROM public.course_contents WHERE id = ANY(%s)",
        (list(material_ids),),
    )
    records_by_id: dict[int, dict[str, Any]] = {}

    for row in rows:
        row_id = _read_optional_int(row, "id")
        if row_id is not None:
            records_by_id[row_id] = row

    return records_by_id


def _fetch_owned_generated_material_rows(
    *,
    project_uuid: str,
    owner_user_id: str,
    tool_type: str | None = None,
) -> list[dict[str, Any]]:
    """Generated materials of a project, checking ownership in the same round trip."""
    if not _is_uuid(project_uuid):
        raise ProjectNotFoundError("Project was not found.")

    rows = db.fetch_all(
        """
        SELECT project.id AS owned_project_id, material.*
        FROM public.projects AS project
        LEFT JOIN public.generated_materials AS material
            ON material.project_uuid = project.project_uuid
           AND (%(tool_type)s::text IS NULL OR material.tool_type = %(tool_type)s::text)
        WHERE project.project_uuid = %(project_uuid)s::uuid AND project.owner_user_id = %(owner)s
        ORDER BY material.created_at DESC, material.id DESC
        """,
        {"tool_type": tool_type, "project_uuid": project_uuid, "owner": owner_user_id},
    )
    if not rows:
        raise ProjectNotFoundError("Project was not found.")

    # A project without generated materials comes back as one row of NULL material columns.
    return [row for row in rows if row.get("id") is not None]


def _fetch_generated_material_row_by_uuid_for_project(
    *,
    project_uuid: str,
    generated_material_uuid: str,
) -> dict[str, Any]:
    if not _is_uuid(project_uuid) or not _is_uuid(generated_material_uuid):
        raise GeneratedMaterialNotFoundError("Generated material was not found.")

    row = db.fetch_one(
        """
        SELECT *
        FROM public.generated_materials
        WHERE project_uuid = %s::uuid AND uuid = %s::uuid
        LIMIT 1
        """,
        (project_uuid, generated_material_uuid),
    )
    if row is None:
        raise GeneratedMaterialNotFoundError("Generated material was not found.")

    return row


def _insert_generated_material_record(
    *,
    project_uuid: str,
    name: str | None,
    file_location: str,
    tool_type: str,
    source_material_ids: list[int],
    payload: dict[str, Any],
    input_token: int | None,
    output_token: int | None,
    uuid: str | None = None,
) -> GeneratedMaterialRecord:
    row = db.fetch_one(
        """
        INSERT INTO public.generated_materials (
            uuid,
            project_uuid,
            name,
            file_location,
            tool_type,
            source_material_ids,
            payload,
            input_token,
            output_token
        )
        VALUES (COALESCE(%s::uuid, gen_random_uuid()), %s::uuid, %s, %s, %s, %s::bigint[], %s::jsonb, %s, %s)
        RETURNING *
        """,
        (
            uuid,
            project_uuid,
            name,
            file_location,
            tool_type,
            list(source_material_ids),
            db.json_param(payload),
            input_token,
            output_token,
        ),
    )
    if row is None:
        raise DataServiceError("Database did not return the inserted generated_materials row.")

    return GeneratedMaterialRecord.model_validate(row)


def _read_latest_project_material_timestamp(material_links: list[dict[str, Any]]) -> Any:
    if not material_links:
        return None

    return material_links[0].get("created_at")


def _upload_storage_object(
    *,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    storage_service.put_object(key=storage_path, body=file_bytes, content_type=content_type)


def _upload_or_replace_storage_object(
    *,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    storage_service.put_object(key=storage_path, body=file_bytes, content_type=content_type)


def _insert_course_content_record(
    *,
    filename: str,
    access_url: str,
    data_size: int,
    project_id: int,
    content_sha256: str,
) -> CourseContentRecord:
    row = db.fetch_one(
        """
        INSERT INTO public.course_contents (
            material_name,
            access_url,
            data_size,
            project_id,
            content_sha256,
            rag_status,
            rag_chunk_count,
            rag_error
        )
        VALUES (%s, %s, %s, %s, %s, 'pending', 0, NULL)
        RETURNING *
        """,
        (filename, access_url, data_size, project_id, content_sha256),
    )
    if row is None:
        raise DataServiceError("Database did not return the inserted course_contents row.")

    return CourseContentRecord.model_validate(row)


def _fetch_course_content_record(
    *,
    course_content_id: int,
) -> CourseContentRecord:
    record = _fetch_course_content_record_optional(course_content_id=course_content_id)
    if record is None:
        raise DataServiceError(f"Course content {course_content_id} was not found.")

    return record


def _update_course_content_record_name(
    *,
    course_content_id: int,
    material_name: str,
) -> CourseContentRecord:
    row = db.fetch_one(
        "UPDATE public.course_contents SET material_name = %s WHERE id = %s RETURNING *",
        (material_name, course_content_id),
    )
    if row is None:
        raise ProjectNotFoundError("Course content was not found.")

    return CourseContentRecord.model_validate(row)


def _fetch_course_content_record_optional(
    *,
    course_content_id: int,
) -> CourseContentRecord | None:
    row = db.fetch_one("SELECT * FROM public.course_contents WHERE id = %s", (course_content_id,))
    if row is None:
        return None

    return CourseContentRecord.model_validate(row)


def _delete_storage_object(
    *,
    storage_path: str,
) -> Optional[str]:
    try:
        storage_service.delete_object(key=storage_path)
    except DataServiceError as exc:
        return str(exc)

    return None


def _delete_storage_object_if_exists(
    *,
    storage_path: str,
) -> Optional[str]:
    return _delete_storage_object(storage_path=storage_path)


def _delete_course_content_record(
    *,
    course_content_id: int,
) -> Optional[str]:
    try:
        db.execute("DELETE FROM public.course_contents WHERE id = %s", (course_content_id,))
    except DataServiceError as exc:
        return str(exc)

    return None


def _update_course_content_rag_status(
    *,
    course_content_id: int,
    rag_status: Literal["pending", "ready", "failed"],
    rag_chunk_count: int,
    rag_error: str | None,
) -> None:
    db.execute(
        """
        UPDATE public.course_contents
        SET rag_status = %s, rag_chunk_count = %s, rag_error = %s
        WHERE id = %s
        """,
        (rag_status, rag_chunk_count, rag_error, course_content_id),
    )


def _replace_course_content_chunks(
    *,
    project_id: int,
    course_content_id: int,
    material_name: str,
    embedded_chunks: list[EmbeddedTextChunk],
) -> None:
    rows = [
        (
            project_id,
            course_content_id,
            material_name,
            embedded_chunk.chunk.index,
            embedded_chunk.chunk.text,
            embedded_chunk.chunk.start_char,
            embedded_chunk.chunk.end_char,
            embedded_chunk.chunk.location_kind,
            embedded_chunk.chunk.location_start,
            embedded_chunk.chunk.location_end,
            _format_vector(embedded_chunk.embedding),
        )
        for embedded_chunk in embedded_chunks
    ]

    with db.transaction() as cursor:
        cursor.execute(
            "DELETE FROM public.course_content_chunks WHERE course_content_id = %s",
            (course_content_id,),
        )
        if rows:
            psycopg2.extras.execute_values(
                cursor,
                """
                INSERT INTO public.course_content_chunks (
                    project_id,
                    course_content_id,
                    material_name,
                    chunk_index,
                    text,
                    start_char,
                    end_char,
                    location_kind,
                    location_start,
                    location_end,
                    embedding
                )
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::public.vector)",
            )


def _delete_course_content_chunks(
    *,
    course_content_id: int,
) -> Optional[str]:
    try:
        db.execute(
            "DELETE FROM public.course_content_chunks WHERE course_content_id = %s",
            (course_content_id,),
        )
    except DataServiceError as exc:
        return str(exc)

    return None


def _normalize_selected_material_ids(
    *,
    selected_material_id: int | None,
    selected_material_ids: list[int] | None,
) -> list[int]:
    normalized_ids: list[int] = []

    for material_id in [selected_material_id, *(selected_material_ids or [])]:
        if not isinstance(material_id, int) or material_id <= 0:
            continue
        if material_id not in normalized_ids:
            normalized_ids.append(material_id)

    return normalized_ids


def _match_course_content_chunks_for_selection(
    *,
    project_id: int,
    query_embedding: list[float],
    selected_material_ids: list[int],
    match_count: int,
) -> list[RagRetrievedChunk]:
    if not selected_material_ids:
        return _match_course_content_chunks(
            project_id=project_id,
            query_embedding=query_embedding,
            selected_material_id=None,
            match_count=match_count,
        )

    if len(selected_material_ids) == 1:
        return _match_course_content_chunks(
            project_id=project_id,
            query_embedding=query_embedding,
            selected_material_id=selected_material_ids[0],
            match_count=match_count,
        )

    chunk_by_key: dict[tuple[int, int], RagRetrievedChunk] = {}

    for material_id in selected_material_ids:
        material_chunks = _match_course_content_chunks(
            project_id=project_id,
            query_embedding=query_embedding,
            selected_material_id=material_id,
            match_count=match_count,
        )

        for chunk in material_chunks:
            chunk_key = (chunk.course_content_id, chunk.chunk_index)
            previous_chunk = chunk_by_key.get(chunk_key)
            if previous_chunk is None or chunk.similarity > previous_chunk.similarity:
                chunk_by_key[chunk_key] = chunk

    return sorted(
        chunk_by_key.values(),
        key=lambda chunk: chunk.similarity,
        reverse=True,
    )[:match_count]


def _match_course_content_chunks(
    *,
    project_id: int,
    query_embedding: list[float],
    selected_material_id: int | None,
    match_count: int,
) -> list[RagRetrievedChunk]:
    rows = db.fetch_all(
        "SELECT * FROM public.match_course_content_chunks(%s::public.vector, %s, %s, %s)",
        (_format_vector(query_embedding), project_id, match_count, selected_material_id),
    )
    chunks: list[RagRetrievedChunk] = []

    for row in rows:
        course_content_id = _read_optional_int(row, "course_content_id")
        chunk_index = _read_optional_int(row, "chunk_index")
        material_name = row.get("material_name")
        text = row.get("text")
        similarity = row.get("similarity")
        location_kind = row.get("location_kind")
        location_start = _read_optional_int(row, "location_start")
        location_end = _read_optional_int(row, "location_end")

        if (
            course_content_id is None
            or chunk_index is None
            or not isinstance(material_name, str)
            or not isinstance(text, str)
        ):
            continue

        chunks.append(
            RagRetrievedChunk(
                course_content_id=course_content_id,
                material_name=material_name,
                chunk_index=chunk_index,
                text=text,
                similarity=float(similarity) if isinstance(similarity, (int, float)) else 0.0,
                location_kind=location_kind if isinstance(location_kind, str) else None,
                location_start=location_start,
                location_end=location_end,
            )
        )

    return chunks


def _build_rag_source_records(chunks: list[RagRetrievedChunk]) -> list[ProjectChatSourceRecord]:
    source_summaries: dict[int, dict[str, Any]] = {}

    for chunk in chunks:
        location_label = _format_rag_location_label(chunk)
        summary = source_summaries.setdefault(
            chunk.course_content_id,
            {
                "material_name": chunk.material_name,
                "chunk_count": 0,
                "top_similarity": chunk.similarity,
                "locations": [],
            },
        )
        summary["chunk_count"] += 1
        summary["top_similarity"] = max(float(summary["top_similarity"]), chunk.similarity)
        if location_label and location_label not in summary["locations"]:
            summary["locations"].append(location_label)

    return [
        ProjectChatSourceRecord(
            id=course_content_id,
            material_name=str(summary["material_name"]),
            chunk_count=int(summary["chunk_count"]),
            top_similarity=float(summary["top_similarity"]),
            locations=[str(location) for location in summary["locations"]],
        )
        for course_content_id, summary in source_summaries.items()
    ]


def _format_rag_source_name(chunk: RagRetrievedChunk) -> str:
    location_label = _format_rag_location_label(chunk)
    if not location_label:
        return chunk.material_name

    return f"{chunk.material_name} ({location_label})"


def _format_rag_location_label(chunk: RagRetrievedChunk) -> str | None:
    if not chunk.location_kind or chunk.location_start is None:
        return None

    location_end = chunk.location_end or chunk.location_start
    if chunk.location_kind == "page":
        return f"pages {chunk.location_start}-{location_end}"

    singular_label = {
        "slide": "slide",
        "section": "section",
    }.get(chunk.location_kind, chunk.location_kind)
    plural_label = {
        "slide": "slides",
        "section": "sections",
    }.get(chunk.location_kind, f"{singular_label}s")

    if location_end != chunk.location_start:
        return f"{plural_label} {chunk.location_start}-{location_end}"

    return f"{singular_label} {chunk.location_start}"


def _upload_preview_manifest(
    *,
    course_content_id: int,
    manifest: CourseContentPreviewManifest,
) -> None:
    _upload_or_replace_storage_object(
        storage_path=_build_preview_manifest_storage_path(course_content_id=course_content_id),
        file_bytes=manifest.model_dump_json().encode("utf-8"),
        content_type="application/json",
    )


def _upload_preview_status(
    *,
    course_content_id: int,
    material_name: str,
    access_url: str,
    source_type: SourceType,
    preview_status: PreviewStatus,
    preview_count: int,
    preview_error: str | None,
) -> None:
    payload = {
        "course_content_id": course_content_id,
        "material_name": material_name,
        "access_url": access_url,
        "source_type": source_type,
        "preview_status": preview_status,
        "preview_count": preview_count,
        "preview_error": preview_error,
    }
    # The row is what reads use; status.json is kept for older deployments and tools.
    db.execute(
        """
        UPDATE public.course_contents
        SET source_type = %s, preview_status = %s, preview_count = %s, preview_error = %s
        WHERE id = %s
        """,
        (source_type, preview_status, preview_count, preview_error, course_content_id),
    )
    _upload_or_replace_storage_object(
        storage_path=_build_preview_status_storage_path(course_content_id=course_content_id),
        file_bytes=json.dumps(payload).encode("utf-8"),
        content_type="application/json",
    )


def _download_preview_manifest(
    *,
    course_content_id: int,
) -> CourseContentPreviewManifest | None:
    response_body = _download_storage_object_optional(
        storage_path=_build_preview_manifest_storage_path(course_content_id=course_content_id),
    )
    if response_body is None:
        return None

    try:
        payload = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise DataServiceError("Stored preview manifest is unreadable.") from exc

    return CourseContentPreviewManifest.model_validate(payload)


def _download_preview_status(
    *,
    course_content_id: int,
) -> dict[str, Any]:
    response_body = _download_storage_object_optional(
        storage_path=_build_preview_status_storage_path(course_content_id=course_content_id),
    )
    if response_body is None:
        return {}

    try:
        payload = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise DataServiceError("Stored preview status is unreadable.") from exc

    return payload if isinstance(payload, dict) else {}


def _build_object_url(*, storage_path: str) -> str:
    return storage_service.build_public_url(key=storage_path)


def _extract_storage_path_from_access_url(*, access_url: str) -> str | None:
    return storage_service.extract_key_from_url(access_url)


def _download_storage_object_optional(
    *,
    storage_path: str,
) -> bytes | None:
    return storage_service.get_object_optional(key=storage_path)


def _detect_source_type(filename: str) -> SourceType:
    suffix = os.path.splitext(filename)[1].lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"

    raise DataServiceError("Unsupported source type.")


def _read_int(row: dict[str, Any], field: str) -> int:
    value = _read_optional_int(row, field)
    if value is None:
        raise DataServiceError(f"Database row is missing integer field {field}.")

    return value


def _read_optional_int(row: dict[str, Any], field: str) -> int | None:
    value = row.get(field)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)

    return None


def _download_object_by_url(object_url: str) -> bytes:
    storage_path = _extract_storage_path_from_access_url(access_url=object_url)
    if not storage_path:
        raise DataServiceError(f"Stored file URL is not in the configured storage bucket: {object_url}")

    file_bytes = _download_storage_object_optional(storage_path=storage_path)
    if file_bytes is None:
        raise DataServiceError(f"Stored file was not found: {storage_path}")

    return file_bytes


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
    except (TypeError, ValueError):
        return False

    return True
