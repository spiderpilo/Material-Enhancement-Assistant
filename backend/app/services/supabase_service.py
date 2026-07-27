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
from urllib import error, parse, request
from uuid import uuid4

from pydantic import ValidationError

from app.config import get_supabase_settings
from app.models.account_model import CreateAccountResponse, LoginAccountResponse, UserProfileRecord
from app.models.chat_model import (
    ProjectChatHistoryResponse,
    ProjectChatMessageRecord,
    ProjectChatResponse,
    ProjectChatSourceRecord,
)
from app.models.document_model import (
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


REQUEST_TIMEOUT_SECONDS = 30
PREVIEW_STORAGE_PREFIX = "course-content-previews"
GENERATED_MATERIALS_STORAGE_PREFIX = "generated-materials"
PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
PDF_CONTENT_TYPE = "application/pdf"
logger = logging.getLogger(__name__)
LEGACY_PROJECTS_NOT_NULL_COLUMNS = ("created_by", "owner_auth_user_id")
CHAT_MEMORY_LIMIT = 10


class MissingSupabaseConfigError(Exception):
    """Raised when the backend is missing required Supabase settings."""


class SupabaseServiceError(Exception):
    """Raised when Supabase storage or database operations fail."""


class PreviewNotFoundError(SupabaseServiceError):
    """Raised when no preview bootstrap or manifest exists for a source id."""


class InvalidCredentialsError(SupabaseServiceError):
    """Raised when login credentials are invalid."""


class AuthenticationError(SupabaseServiceError):
    """Raised when a request is missing valid user authentication."""


class ProjectNotFoundError(SupabaseServiceError):
    """Raised when a project does not exist or is not owned by the current user."""


class ProjectAccessDeniedError(SupabaseServiceError):
    """Raised when a project exists but is not owned by the current user."""


class GeneratedMaterialNotFoundError(SupabaseServiceError):
    """Raised when a generated material record cannot be found for a project."""


class DuplicateCourseContentError(SupabaseServiceError):
    """Raised when the same source bytes already exist in a project."""


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
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


def login_account(*, email: str, password: str) -> LoginAccountResponse:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_api_key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or settings.service_role_key
    )

    payload = json.dumps({"email": email, "password": password}).encode("utf-8")

    try:
        response_body = _send_request(
            endpoint=f"{settings.url.rstrip('/')}/auth/v1/token?grant_type=password",
            method="POST",
            data=payload,
            headers={
                "apikey": auth_api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            expected_statuses={200},
        )
    except SupabaseServiceError as exc:
        error_message = str(exc).lower()
        if "invalid login credentials" in error_message or "invalid_grant" in error_message:
            raise InvalidCredentialsError("Incorrect email or password") from exc
        raise

    try:
        auth_response = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable login response.") from exc

    if not isinstance(auth_response, dict):
        raise SupabaseServiceError("Supabase did not return a valid login payload.")

    access_token = auth_response.get("access_token")
    refresh_token = auth_response.get("refresh_token")
    token_type = auth_response.get("token_type")
    user = auth_response.get("user")

    if (
        not isinstance(access_token, str)
        or not isinstance(refresh_token, str)
        or not isinstance(token_type, str)
        or not isinstance(user, dict)
    ):
        raise SupabaseServiceError("Supabase login response is missing required fields.")

    user_id = user.get("id")
    user_email = user.get("email")
    user_metadata = user.get("user_metadata") if isinstance(user.get("user_metadata"), dict) else {}
    username = user_metadata.get("username") if isinstance(user_metadata.get("username"), str) else ""
    profession = user_metadata.get("profession") if isinstance(user_metadata.get("profession"), str) else ""

    if not isinstance(user_id, str) or not isinstance(user_email, str):
        raise SupabaseServiceError("Supabase login response is missing user identity data.")

    return LoginAccountResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type=token_type,
        user_id=user_id,
        email=user_email,
        username=username,
        profession=profession,
    )


def create_account(*, email: str, password: str, username: str, profession: str) -> CreateAccountResponse:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _create_supabase_auth_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        email=email,
        password=password,
        username=username,
        profession=profession,
    )

    try:
        profile = _insert_user_profile(
            url=settings.url,
            service_role_key=settings.service_role_key,
            username=username,
            profession=profession,
        )
    except SupabaseServiceError as exc:
        cleanup_error = _delete_supabase_auth_user(
            url=settings.url,
            service_role_key=settings.service_role_key,
            user_id=auth_user["id"],
        )
        if cleanup_error:
            raise SupabaseServiceError(f"{exc} Cleanup failed: {cleanup_error}") from exc
        raise

    return CreateAccountResponse(auth_user_id=auth_user["id"], profile=profile)


def list_projects_for_user(*, access_token: str, limit: int | None = None) -> list[ProjectSummary]:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )

    projects = _fetch_project_rows_for_owner(
        url=settings.url,
        service_role_key=settings.service_role_key,
        owner_user_id=auth_user.user_id,
        limit=limit,
    )

    return [_build_project_summary(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_row=project,
        )
        for project in projects
    ]


def create_project_for_user(*, access_token: str, name: str) -> ProjectSummary:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    profile = _get_user_profile_optional(
        url=settings.url,
        service_role_key=settings.service_role_key,
        auth_user=auth_user,
    )

    try:
        project_row = _insert_project_record(
            url=settings.url,
            service_role_key=settings.service_role_key,
            name=name,
            owner_user_id=auth_user.user_id,
        )
    except SupabaseServiceError as exc:
        if not _is_legacy_projects_not_null_error(exc):
            raise

        legacy_created_by: str | int = profile.id if profile else auth_user.user_id
        logger.warning(
            "Retrying project insert with legacy columns because projects schema is mixed-contract: %s",
            exc,
        )
        try:
            project_row = _insert_project_record(
                url=settings.url,
                service_role_key=settings.service_role_key,
                name=name,
                owner_user_id=auth_user.user_id,
                owner_auth_user_id=auth_user.user_id,
                created_by=legacy_created_by,
            )
        except SupabaseServiceError as retry_exc:
            if _is_legacy_projects_not_null_error(retry_exc):
                raise SupabaseServiceError(
                    _build_legacy_projects_migration_hint_message(str(retry_exc))
                ) from retry_exc
            raise

    if profile:
        try:
            _insert_user_project_link(
                url=settings.url,
                service_role_key=settings.service_role_key,
                user_id=profile.id,
                project_id=_read_int(project_row, "id"),
            )
        except SupabaseServiceError as exc:
            logger.warning("Skipping user_projects link for project_id=%s: %s", project_row.get("id"), exc)

    return _build_project_summary(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_row=project_row,
    )


def get_project_for_user(*, access_token: str, project_uuid: str) -> ProjectRecord:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    project_row = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )

    return _build_project_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_row=project_row,
        include_materials=True,
    )


def update_project_for_user(*, access_token: str, project_uuid: str, name: str) -> ProjectRecord:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    project_row = _fetch_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
    )
    project_owner_user_id = project_row.get("owner_user_id")
    if not isinstance(project_owner_user_id, str) or not project_owner_user_id.strip():
        raise SupabaseServiceError("Project row is missing an owner_user_id.")
    if project_owner_user_id != auth_user.user_id:
        raise ProjectAccessDeniedError("You do not have permission to update this project.")

    project_id = _read_int(project_row, "id")
    updated_row = _update_project_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
        name=name,
    )

    return _build_project_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_row=updated_row,
        include_materials=True,
    )


def delete_project_for_user(*, access_token: str, project_uuid: str) -> None:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    project_row = _fetch_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
    )
    project_owner_user_id = project_row.get("owner_user_id")
    if not isinstance(project_owner_user_id, str) or not project_owner_user_id.strip():
        raise SupabaseServiceError("Project row is missing an owner_user_id.")
    if project_owner_user_id != auth_user.user_id:
        raise ProjectAccessDeniedError("You do not have permission to delete this project.")

    project_id = _read_int(project_row, "id")
    material_links = _fetch_project_material_links(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
    )
    for link in material_links:
        material_id = _read_optional_int(link, "material_id")
        if material_id is None:
            continue
        cleanup_error = _delete_project_material_link(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_id=project_id,
            material_id=material_id,
        )
        if cleanup_error:
            raise SupabaseServiceError(cleanup_error)

    user_project_cleanup_error = _delete_user_project_links_for_project(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
    )
    if user_project_cleanup_error:
        raise SupabaseServiceError(user_project_cleanup_error)

    delete_error = _delete_project_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
    )
    if delete_error:
        raise SupabaseServiceError(delete_error)


def upload_course_content(
    *,
    filename: str,
    file_bytes: bytes,
    project_id: int,
    access_token: str,
) -> CourseContentRecord:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    _fetch_owned_project_row(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
        owner_user_id=auth_user.user_id,
    )
    content_sha256 = _compute_content_sha256(file_bytes)
    duplicate_record = _fetch_duplicate_course_content_for_project(
        url=settings.url,
        service_role_key=settings.service_role_key,
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
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        storage_path=storage_path,
        file_bytes=file_bytes,
        content_type=content_type,
    )

    access_url = _build_object_url(
        url=settings.url,
        bucket=settings.storage_bucket,
        storage_path=storage_path,
    )

    try:
        inserted_record = _insert_course_content_record(
            url=settings.url,
            service_role_key=settings.service_role_key,
            filename=filename,
            access_url=access_url,
            data_size=len(file_bytes),
            project_id=project_id,
            content_sha256=content_sha256,
        )
        _insert_project_material_link(
            url=settings.url,
            service_role_key=settings.service_role_key,
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
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
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
    except SupabaseServiceError as exc:
        logger.error(
            "Preview bootstrap write failed for filename=%s: %s",
            filename,
            exc,
        )

        cleanup_messages: list[str] = []

        if "inserted_record" in locals():
            cleanup_link_error = _delete_project_material_link(
                url=settings.url,
                service_role_key=settings.service_role_key,
                project_id=project_id,
                material_id=inserted_record.id,
            )
            if cleanup_link_error:
                cleanup_messages.append(cleanup_link_error)

            cleanup_record_error = _delete_course_content_record(
                url=settings.url,
                service_role_key=settings.service_role_key,
                course_content_id=inserted_record.id,
            )
            if cleanup_record_error:
                cleanup_messages.append(cleanup_record_error)

        cleanup_error = _delete_storage_object(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
            storage_path=storage_path,
        )
        if cleanup_error:
            cleanup_messages.append(cleanup_error)

        if cleanup_messages:
            raise SupabaseServiceError(
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    source_type = _detect_source_type(filename)

    try:
        _upload_preview_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
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
                url=settings.url,
                service_role_key=settings.service_role_key,
                bucket=settings.storage_bucket,
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
                        url=settings.url,
                        bucket=settings.storage_bucket,
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
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
            course_content_id=course_content_id,
            manifest=manifest,
        )
        _upload_preview_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
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
    except (DocumentPreviewError, SupabaseServiceError, MissingSupabaseConfigError) as exc:
        logger.error(
            "Preview render failed for course_content_id=%s: %s",
            course_content_id,
            exc,
        )
        _upload_preview_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    source_type = _detect_source_type(filename)

    try:
        _update_course_content_rag_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
            course_content_id=course_content_id,
            rag_status="pending",
            rag_chunk_count=0,
            rag_error=None,
        )
        parsed_units = parse_document_units(file_bytes=file_bytes, file_type=source_type)
        chunks = _chunk_parsed_text_units(parsed_units)
        if not chunks:
            raise SupabaseServiceError("No text chunks could be created from the uploaded file.")

        embedded_chunks = embed_chunks(chunks)
        _replace_course_content_chunks(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_id=project_id,
            course_content_id=course_content_id,
            material_name=filename,
            embedded_chunks=embedded_chunks,
        )
        _update_course_content_rag_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
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
        SupabaseServiceError,
        ValueError,
    ) as exc:
        logger.error(
            "RAG indexing failed for course_content_id=%s: %s",
            course_content_id,
            exc,
        )
        _update_course_content_rag_status(
            url=settings.url,
            service_role_key=settings.service_role_key,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    manifest = _download_preview_manifest(
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        course_content_id=course_content_id,
    )
    if manifest:
        logger.info(
            "Preview GET source=manifest course_content_id=%s",
            course_content_id,
        )
        return manifest.model_copy(update={"preview_count": len(manifest.items)})

    preview_status_payload = _download_preview_status(
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        course_content_id=course_content_id,
    )
    preview_manifest = _build_preview_manifest_from_status_payload(preview_status_payload)
    if preview_manifest:
        logger.info(
            "Preview GET source=status course_content_id=%s",
            course_content_id,
        )
        return preview_manifest

    record = _fetch_course_content_record_optional(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
    )
    if record:
        logger.info(
            "Preview GET source=db-fallback course_content_id=%s",
            course_content_id,
        )
        source_type = record.source_type or _detect_source_type(record.material_name)
        return CourseContentPreviewManifest(
            course_content_id=record.id,
            material_name=record.material_name,
            source_type=source_type,
            preview_status="pending",
            preview_count=0,
            access_url=record.access_url,
            preview_error=None,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    return get_course_content_preview(course_content_id=course_content_id)


def update_course_content_name_for_user(
    *,
    access_token: str,
    course_content_id: int,
    material_name: str,
) -> CourseContentRecord:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    record = _fetch_course_content_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
    )
    next_material_name = _normalize_locked_material_name(
        requested_name=material_name,
        current_name=record.material_name,
    )

    if next_material_name != record.material_name:
        record = _update_course_content_record_name(
            url=settings.url,
            service_role_key=settings.service_role_key,
            course_content_id=course_content_id,
            material_name=next_material_name,
        )

    source_type = record.source_type or _detect_source_type(record.material_name)
    preview_metadata = _refresh_course_content_preview_metadata(
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    _assert_course_content_owned_by_username(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
        owner_user_id=auth_user.user_id,
    )

    record = _fetch_course_content_record_optional(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
    )
    if record is None:
        raise ProjectNotFoundError("Course content was not found.")

    material_links = _fetch_project_material_links_for_material(
        url=settings.url,
        service_role_key=settings.service_role_key,
        material_id=course_content_id,
    )
    for link in material_links:
        project_id = _read_optional_int(link, "project_id")
        if project_id is None:
            continue

        cleanup_error = _delete_project_material_link(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_id=project_id,
            material_id=course_content_id,
        )
        if cleanup_error:
            raise SupabaseServiceError(cleanup_error)

    _delete_course_content_preview_assets(
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        course_content_id=course_content_id,
    )
    chunk_delete_error = _delete_course_content_chunks(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
    )
    if chunk_delete_error:
        raise SupabaseServiceError(chunk_delete_error)

    source_storage_path = _extract_storage_path_from_access_url(
        access_url=record.access_url,
        bucket=settings.storage_bucket,
    )
    if source_storage_path:
        source_delete_error = _delete_storage_object_if_exists(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
            storage_path=source_storage_path,
        )
        if source_delete_error:
            raise SupabaseServiceError(source_delete_error)

    delete_error = _delete_course_content_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        course_content_id=course_content_id,
    )
    if delete_error:
        raise SupabaseServiceError(delete_error)


def get_course_content_texts_for_user(
    *,
    access_token: str,
    project_uuid: str | None = None,
    material_ids: list[int],
) -> list[QuizSourceMaterial]:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    unique_material_ids = list(dict.fromkeys(material_ids))
    normalized_project_uuid = (project_uuid or "").strip()

    if normalized_project_uuid:
        project_row = _fetch_owned_project_row_by_uuid(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_uuid=normalized_project_uuid,
            owner_user_id=auth_user.user_id,
        )
        project_id = _read_int(project_row, "id")
        _assert_materials_linked_to_project(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_id=project_id,
            material_ids=unique_material_ids,
        )

    for material_id in unique_material_ids:
        _assert_course_content_owned_by_username(
            url=settings.url,
            service_role_key=settings.service_role_key,
            course_content_id=material_id,
            owner_user_id=auth_user.user_id,
        )

    records_by_id = _fetch_course_content_records_by_id(
        url=settings.url,
        service_role_key=settings.service_role_key,
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
        file_bytes = _send_request(
            endpoint=record.access_url,
            method="GET",
            headers=_build_auth_headers(settings.service_role_key),
            expected_statuses={200},
        )

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
        raise SupabaseServiceError(f"Unable to read selected sources for quiz generation: {detail}")

    return source_materials


def answer_project_question_for_user(
    *,
    access_token: str,
    project_uuid: str,
    message: str,
    selected_material_id: int | None = None,
    selected_material_ids: list[int] | None = None,
) -> ProjectChatResponse:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    project = get_project_for_user(access_token=access_token, project_uuid=project_uuid)
    if project.id is None:
        raise SupabaseServiceError("Project record is missing a numeric id.")
    if not project.materials:
        raise ProjectNotFoundError("No course materials were found for this project.")

    history = _fetch_project_chat_messages(
        url=settings.url,
        service_role_key=settings.service_role_key,
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
        url=settings.url,
        service_role_key=settings.service_role_key,
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
            url=settings.url,
            service_role_key=settings.service_role_key,
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
        url=settings.url,
        service_role_key=settings.service_role_key,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    project = get_project_for_user(access_token=access_token, project_uuid=project_uuid)
    if project.id is None:
        raise SupabaseServiceError("Project record is missing a numeric id.")

    return ProjectChatHistoryResponse(
        messages=_fetch_project_chat_messages(
            url=settings.url,
            service_role_key=settings.service_role_key,
            project_id=project.id,
            owner_user_id=project.owner_user_id,
        )
    )


def clear_project_chat_history_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> None:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    project = get_project_for_user(access_token=access_token, project_uuid=project_uuid)
    if project.id is None:
        raise SupabaseServiceError("Project record is missing a numeric id.")

    _delete_project_chat_memory(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project.id,
        owner_user_id=project.owner_user_id,
    )


def _fetch_project_chat_messages(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    owner_user_id: str,
) -> list[ProjectChatMessageRecord]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_chat_memory"
        f"?project_id=eq.{project_id}"
        f"&owner_user_id=eq.{parse.quote(owner_user_id, safe='')}"
        "&select=messages"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "project chat memory")
    if not rows:
        return []

    raw_messages = rows[0].get("messages")
    return _validate_project_chat_messages(raw_messages)


def _append_project_chat_exchange(
    *,
    url: str,
    service_role_key: str,
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
    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/rpc/append_project_chat_exchange",
        method="POST",
        data=json.dumps(
            {
                "filter_project_id": project_id,
                "filter_owner_user_id": owner_user_id,
                "user_message": user_message,
                "assistant_message": assistant_message,
            }
        ).encode("utf-8"),
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    return _validate_project_chat_messages(
        _decode_json_payload(response_body, "project chat exchange")
    )


def _delete_project_chat_memory(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    owner_user_id: str,
) -> None:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_chat_memory"
        f"?project_id=eq.{project_id}"
        f"&owner_user_id=eq.{parse.quote(owner_user_id, safe='')}"
    )
    _send_request(
        endpoint=endpoint,
        method="DELETE",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200, 204},
    )


def _validate_project_chat_messages(raw_messages: Any) -> list[ProjectChatMessageRecord]:
    if not isinstance(raw_messages, list):
        raise SupabaseServiceError("Project chat memory returned an invalid message list.")

    try:
        messages = [
            ProjectChatMessageRecord.model_validate(message)
            for message in raw_messages[-CHAT_MEMORY_LIMIT:]
        ]
    except ValidationError as exc:
        raise SupabaseServiceError("Project chat memory contains an invalid message.") from exc

    return messages


def list_generated_materials_for_user(
    *,
    access_token: str,
    project_uuid: str,
) -> list[GeneratedMaterialRecord]:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project_uuid = _normalize_project_row(owned_project)["project_uuid"]
    rows = _fetch_generated_material_rows_for_project_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=normalized_project_uuid,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project_uuid = _normalize_project_row(owned_project)["project_uuid"]
    rows = _fetch_generated_material_rows_for_project_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=normalized_project_uuid,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)
    project_id = _read_int(owned_project, "id")
    unique_material_ids = list(dict.fromkeys(material_ids))
    _assert_material_ids_linked_to_project(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_id=project_id,
        material_ids=unique_material_ids,
    )

    for material_id in unique_material_ids:
        _assert_course_content_owned_by_username(
            url=settings.url,
            service_role_key=settings.service_role_key,
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
        url=settings.url,
        service_role_key=settings.service_role_key,
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
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)
    project_id = _read_int(owned_project, "id")
    unique_material_ids = list(dict.fromkeys(material_ids))
    _assert_material_ids_linked_to_project(
        url=settings.url,
        service_role_key=settings.service_role_key,
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
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        storage_path=storage_path,
        file_bytes=deck_bytes,
        content_type=PPTX_CONTENT_TYPE,
    )
    file_location = _build_object_url(
        url=settings.url,
        bucket=settings.storage_bucket,
        storage_path=storage_path,
    )
    preview_result = _build_generated_slide_deck_preview(
        url=settings.url,
        service_role_key=settings.service_role_key,
        bucket=settings.storage_bucket,
        project_uuid=normalized_project["project_uuid"],
        generated_material_uuid=generated_uuid,
        deck_filename=storage_filename,
        deck_bytes=deck_bytes,
    )

    try:
        return _insert_generated_material_record(
            url=settings.url,
            service_role_key=settings.service_role_key,
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
    except SupabaseServiceError as exc:
        cleanup_errors: list[str] = []
        cleanup_paths = [storage_path, *preview_result.storage_paths]
        for cleanup_path in cleanup_paths:
            cleanup_error = _delete_storage_object_if_exists(
                url=settings.url,
                service_role_key=settings.service_role_key,
                bucket=settings.storage_bucket,
                storage_path=cleanup_path,
            )
            if cleanup_error:
                cleanup_errors.append(cleanup_error)
        if cleanup_errors:
            raise SupabaseServiceError(f"{exc} Cleanup failed: {' | '.join(cleanup_errors)}") from exc
        raise


def get_generated_material_download_for_user(
    *,
    access_token: str,
    project_uuid: str,
    generated_material_uuid: str,
    download_format: Literal["pptx", "pdf"] = "pptx",
) -> tuple[str, str]:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    auth_user = _resolve_authenticated_user(
        url=settings.url,
        service_role_key=settings.service_role_key,
        access_token=access_token,
    )
    owned_project = _fetch_owned_project_row_by_uuid(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=project_uuid,
        owner_user_id=auth_user.user_id,
    )
    normalized_project = _normalize_project_row(owned_project)

    row = _fetch_generated_material_row_by_uuid_for_project(
        url=settings.url,
        service_role_key=settings.service_role_key,
        project_uuid=normalized_project["project_uuid"],
        generated_material_uuid=generated_material_uuid,
    )
    record = GeneratedMaterialRecord.model_validate(row)

    if record.file_location.startswith("inline://"):
        raise SupabaseServiceError("This generated material does not include a downloadable file.")

    base_filename = sanitize_filename(
        (record.name or f"generated-{record.tool_type}").strip(),
        fallback_name=f"generated-{record.tool_type}",
    )

    if download_format == "pdf":
        if record.tool_type != "slide_deck":
            raise SupabaseServiceError("PDF download is only available for generated slide decks.")

        pdf_filename = _ensure_file_extension(base_filename=base_filename, extension="pdf")
        pdf_storage_path = _build_generated_material_storage_path(
            project_uuid=normalized_project["project_uuid"],
            generated_material_uuid=record.uuid,
            filename=pdf_filename,
        )
        cached_pdf = _download_storage_object_optional(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
            storage_path=pdf_storage_path,
        )

        if cached_pdf is None:
            source_pptx_storage_path = _extract_storage_path_from_access_url(
                access_url=record.file_location,
                bucket=settings.storage_bucket,
            )
            source_pptx_bytes: bytes | None = None

            if source_pptx_storage_path:
                source_pptx_bytes = _download_storage_object_optional(
                    url=settings.url,
                    service_role_key=settings.service_role_key,
                    bucket=settings.storage_bucket,
                    storage_path=source_pptx_storage_path,
                )

            if source_pptx_bytes is None:
                source_pptx_bytes = _send_request(
                    endpoint=record.file_location,
                    method="GET",
                    headers=_build_auth_headers(settings.service_role_key),
                    expected_statuses={200},
                )

            source_pptx_name = _ensure_file_extension(base_filename=base_filename, extension="pptx")
            converted_pdf = convert_pptx_to_pdf_bytes(
                filename=source_pptx_name,
                file_bytes=source_pptx_bytes,
            )
            _upload_or_replace_storage_object(
                url=settings.url,
                service_role_key=settings.service_role_key,
                bucket=settings.storage_bucket,
                storage_path=pdf_storage_path,
                file_bytes=converted_pdf,
                content_type=PDF_CONTENT_TYPE,
            )

        return _build_object_url(
            url=settings.url,
            bucket=settings.storage_bucket,
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
    url: str,
    service_role_key: str,
    bucket: str,
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
                url=url,
                service_role_key=service_role_key,
                bucket=bucket,
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
                        url=url,
                        bucket=bucket,
                        storage_path=preview_storage_path,
                    ),
                    "width": item.width,
                    "height": item.height,
                }
            )
    except (DocumentPreviewError, SupabaseServiceError) as exc:
        cleanup_errors: list[str] = []
        for uploaded_path in uploaded_preview_paths:
            cleanup_error = _delete_storage_object_if_exists(
                url=url,
                service_role_key=service_role_key,
                bucket=bucket,
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
        raise SupabaseServiceError("Source name cannot be empty.")

    current_suffix = os.path.splitext(current_name)[1].lower()
    if not current_suffix:
        raise SupabaseServiceError("Source filename is missing an extension.")
    _detect_source_type(f"placeholder{current_suffix}")

    sanitized_base_name = sanitize_filename(requested_base_name, fallback_name="material")
    normalized_base_name = os.path.splitext(sanitized_base_name)[0].strip("._-")
    if not normalized_base_name:
        normalized_base_name = "material"

    return f"{normalized_base_name}{current_suffix}"


def _refresh_course_content_preview_metadata(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    course_content_id: int,
    material_name: str,
    access_url: str,
    source_type: SourceType,
    fallback_preview_status: PreviewStatus,
    fallback_preview_count: int,
) -> dict[str, Any]:
    preview_status_payload = _download_preview_status(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
        course_content_id=course_content_id,
    )
    preview_manifest = _download_preview_manifest(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
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
            url=url,
            service_role_key=service_role_key,
            bucket=bucket,
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
            url=url,
            service_role_key=service_role_key,
            bucket=bucket,
            course_content_id=course_content_id,
            manifest=preview_manifest.model_copy(update={"material_name": material_name}),
        )

    return {
        "preview_status": preview_status,
        "preview_count": preview_count,
    }


def _delete_course_content_preview_assets(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    course_content_id: int,
) -> None:
    preview_manifest = _download_preview_manifest(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
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
                bucket=bucket,
            )
            if preview_item_storage_path:
                preview_storage_paths.add(preview_item_storage_path)

    for storage_path in sorted(preview_storage_paths):
        cleanup_error = _delete_storage_object_if_exists(
            url=url,
            service_role_key=service_role_key,
            bucket=bucket,
            storage_path=storage_path,
        )
        if cleanup_error:
            raise SupabaseServiceError(cleanup_error)


def _create_supabase_auth_user(
    *,
    url: str,
    service_role_key: str,
    email: str,
    password: str,
    username: str,
    profession: str,
) -> dict[str, Any]:
    payload = json.dumps(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "username": username,
                "profession": profession,
            },
        }
    ).encode("utf-8")

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/auth/v1/admin/users",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200, 201},
    )

    try:
        created_user = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable auth response.") from exc

    if not isinstance(created_user, dict) or "id" not in created_user:
        raise SupabaseServiceError("Supabase did not return the created auth user.")

    return created_user


def _insert_user_profile(
    *,
    url: str,
    service_role_key: str,
    username: str,
    profession: str,
) -> UserProfileRecord:
    payload = json.dumps(
        {
            "username": username,
            "profession": profession,
        }
    ).encode("utf-8")

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/users",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 201},
    )

    try:
        inserted_rows = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable users response.") from exc

    if not isinstance(inserted_rows, list) or not inserted_rows:
        raise SupabaseServiceError("Supabase did not return the inserted users row.")

    return UserProfileRecord.model_validate(inserted_rows[0])


def _delete_supabase_auth_user(*, url: str, service_role_key: str, user_id: str) -> Optional[str]:
    endpoint = f"{url.rstrip('/')}/auth/v1/admin/users/{parse.quote(user_id, safe='')}"

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers=_build_auth_headers(service_role_key),
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _resolve_authenticated_user(
    *,
    url: str,
    service_role_key: str,
    access_token: str,
) -> AuthenticatedUser:
    if not access_token.strip():
        raise AuthenticationError("Sign in required.")

    auth_api_key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or service_role_key
    )

    try:
        response_body = _send_request(
            endpoint=f"{url.rstrip('/')}/auth/v1/user",
            method="GET",
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": auth_api_key,
                "Accept": "application/json",
            },
            expected_statuses={200},
        )
    except SupabaseServiceError as exc:
        raise AuthenticationError("Sign in required.") from exc

    payload = _decode_json_payload(response_body, "Supabase auth user")
    if not isinstance(payload, dict):
        raise AuthenticationError("Supabase did not return a valid auth user.")

    user_id = payload.get("id")
    email = payload.get("email")
    metadata = payload.get("user_metadata") if isinstance(payload.get("user_metadata"), dict) else {}
    metadata_username = metadata.get("username")
    profession = metadata.get("profession")

    if not isinstance(user_id, str) or not user_id.strip():
        raise AuthenticationError("Supabase auth user is missing an id.")
    if not isinstance(email, str):
        email = ""
    username = metadata_username if isinstance(metadata_username, str) else ""
    if not isinstance(profession, str):
        profession = ""

    return AuthenticatedUser(
        user_id=user_id,
        email=email,
        username=username.strip(),
        profession=profession.strip(),
    )


def _get_user_profile_optional(
    *,
    url: str,
    service_role_key: str,
    auth_user: AuthenticatedUser,
) -> UserProfileRecord | None:
    if not auth_user.username:
        return None

    profile = _fetch_user_profile_by_username(
        url=url,
        service_role_key=service_role_key,
        username=auth_user.username,
    )
    if profile:
        return profile

    if auth_user.profession not in {"student", "professor"}:
        return None

    return _insert_user_profile(
        url=url,
        service_role_key=service_role_key,
        username=auth_user.username,
        profession=auth_user.profession,
    )


def _fetch_user_profile_by_username(
    *,
    url: str,
    service_role_key: str,
    username: str,
) -> UserProfileRecord | None:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/users"
        f"?username=eq.{parse.quote(username, safe='')}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "users")

    if not rows:
        return None

    return UserProfileRecord.model_validate(rows[0])


def _fetch_project_rows_for_owner(
    *,
    url: str,
    service_role_key: str,
    owner_user_id: str,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    limit_clause = f"&limit={limit}" if isinstance(limit, int) and limit > 0 else ""
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/projects"
        f"?owner_user_id=eq.{parse.quote(owner_user_id, safe='')}"
        "&select=*&order=created_at.desc.nullslast,id.desc"
        f"{limit_clause}"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    return _decode_json_rows(response_body, "projects")


def _fetch_owned_project_row(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    owner_user_id: str,
) -> dict[str, Any]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/projects"
        f"?id=eq.{project_id}&owner_user_id=eq.{parse.quote(owner_user_id, safe='')}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "projects")

    if not rows:
        raise ProjectNotFoundError("Project was not found.")

    return rows[0]


def _fetch_owned_project_row_by_uuid(
    *,
    url: str,
    service_role_key: str,
    project_uuid: str,
    owner_user_id: str,
) -> dict[str, Any]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/projects"
        f"?project_uuid=eq.{parse.quote(project_uuid, safe='')}"
        f"&owner_user_id=eq.{parse.quote(owner_user_id, safe='')}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "projects")

    if not rows:
        raise ProjectNotFoundError("Project was not found.")

    return rows[0]


def _fetch_project_row_by_uuid(
    *,
    url: str,
    service_role_key: str,
    project_uuid: str,
) -> dict[str, Any]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/projects"
        f"?project_uuid=eq.{parse.quote(project_uuid, safe='')}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "projects")

    if not rows:
        raise ProjectNotFoundError("Project was not found.")

    return rows[0]


def _insert_project_record(
    *,
    url: str,
    service_role_key: str,
    name: str,
    owner_user_id: str,
    owner_auth_user_id: str | None = None,
    created_by: str | int | None = None,
) -> dict[str, Any]:
    payload_map: dict[str, Any] = {
        "name": name,
        "owner_user_id": owner_user_id,
    }
    if owner_auth_user_id:
        payload_map["owner_auth_user_id"] = owner_auth_user_id
    if created_by is not None:
        payload_map["created_by"] = created_by

    payload = json.dumps(payload_map).encode("utf-8")

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/projects",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 201},
    )
    rows = _decode_json_rows(response_body, "projects")

    if not rows:
        raise SupabaseServiceError("Supabase did not return the inserted projects row.")

    return rows[0]


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
    url: str,
    service_role_key: str,
    project_id: int,
    name: str,
) -> dict[str, Any]:
    payload = json.dumps({"name": name}).encode("utf-8")

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/projects?id=eq.{project_id}",
        method="PATCH",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 204},
    )
    rows = _decode_json_rows(response_body, "projects") if response_body else []

    if not rows:
        raise ProjectNotFoundError("Project was not found.")

    return rows[0]


def _delete_project_record(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
) -> Optional[str]:
    endpoint = f"{url.rstrip('/')}/rest/v1/projects?id=eq.{project_id}"

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers={
                **_build_auth_headers(service_role_key),
                "Accept": "application/json",
            },
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _delete_user_project_links_for_project(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
) -> Optional[str]:
    endpoint = f"{url.rstrip('/')}/rest/v1/user_projects?project_id=eq.{project_id}"

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers={
                **_build_auth_headers(service_role_key),
                "Accept": "application/json",
            },
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _insert_user_project_link(
    *,
    url: str,
    service_role_key: str,
    user_id: int,
    project_id: int,
) -> None:
    payload = json.dumps(
        {
            "user_id": user_id,
            "project_id": project_id,
        }
    ).encode("utf-8")

    _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/user_projects",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200, 201},
    )


def _insert_project_material_link(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    material_id: int,
) -> None:
    payload = json.dumps(
        {
            "project_id": project_id,
            "material_id": material_id,
        }
    ).encode("utf-8")

    _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/project_materials",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200, 201},
    )


def _delete_project_material_link(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    material_id: int,
) -> Optional[str]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_materials"
        f"?project_id=eq.{project_id}&material_id=eq.{material_id}"
    )

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers={
                **_build_auth_headers(service_role_key),
                "Accept": "application/json",
            },
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _build_project_summary(
    *,
    url: str,
    service_role_key: str,
    project_row: dict[str, Any],
) -> ProjectSummary:
    project_id = _read_int(project_row, "id")
    material_links = _fetch_project_material_links(
        url=url,
        service_role_key=service_role_key,
        project_id=project_id,
    )
    normalized_row = _normalize_project_row(project_row)
    last_updated = _read_latest_project_material_timestamp(material_links)

    return ProjectSummary.model_validate(
        {
            **normalized_row,
            "material_count": len(material_links),
            "last_updated": last_updated,
        }
    )


def _build_project_record(
    *,
    url: str,
    service_role_key: str,
    project_row: dict[str, Any],
    include_materials: bool,
) -> ProjectRecord:
    summary = _build_project_summary(
        url=url,
        service_role_key=service_role_key,
        project_row=project_row,
    )
    project_id = summary.id
    if project_id is None:
        raise SupabaseServiceError("Project record is missing a numeric id.")

    material_links = _fetch_project_material_links(
        url=url,
        service_role_key=service_role_key,
        project_id=project_id,
    )

    materials = (
        _fetch_project_material_records(
            url=url,
            service_role_key=service_role_key,
            material_links=material_links,
        )
        if include_materials
        else []
    )

    return ProjectRecord.model_validate(
        {
            **summary.model_dump(),
            "materials": materials,
        }
    )


def _normalize_project_row(project_row: dict[str, Any]) -> dict[str, Any]:
    project_uuid = project_row.get("project_uuid")
    owner_user_id = project_row.get("owner_user_id")
    created_at = project_row.get("created_at")
    updated_at = project_row.get("updated_at")

    if not isinstance(project_uuid, str) or not project_uuid.strip():
        raise SupabaseServiceError("Project row is missing a project_uuid.")
    if not isinstance(owner_user_id, str) or not owner_user_id.strip():
        raise SupabaseServiceError("Project row is missing an owner_user_id.")

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
    url: str,
    service_role_key: str,
    project_id: int,
) -> list[dict[str, Any]]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_materials"
        f"?project_id=eq.{project_id}&select=created_at,material_id&order=created_at.desc"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    return _decode_json_rows(response_body, "project_materials")


def _fetch_project_material_links_for_material(
    *,
    url: str,
    service_role_key: str,
    material_id: int,
) -> list[dict[str, Any]]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_materials"
        f"?material_id=eq.{material_id}&select=project_id,material_id"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    return _decode_json_rows(response_body, "project_materials")


def _fetch_duplicate_course_content_for_project(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    content_sha256: str,
) -> CourseContentRecord | None:
    material_links = _fetch_project_material_links(
        url=url,
        service_role_key=service_role_key,
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
        url=url,
        service_role_key=service_role_key,
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
    url: str,
    service_role_key: str,
    project_id: int,
    material_ids: list[int],
) -> None:
    project_material_links = _fetch_project_material_links(
        url=url,
        service_role_key=service_role_key,
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


def _fetch_project_material_records(
    *,
    url: str,
    service_role_key: str,
    material_links: list[dict[str, Any]],
) -> list[ProjectMaterialRecord]:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

    material_ids = [
        material_id
        for material_id in (_read_optional_int(link, "material_id") for link in material_links)
        if material_id is not None
    ]
    if not material_ids:
        return []

    records_by_id = _fetch_course_content_records_by_id(
        url=url,
        service_role_key=service_role_key,
        material_ids=material_ids,
    )
    materials: list[ProjectMaterialRecord] = []

    for link in material_links:
        material_id = _read_optional_int(link, "material_id")
        if material_id is None or material_id not in records_by_id:
            continue

        base_record = CourseContentRecord.model_validate(records_by_id[material_id])
        preview_status_payload = _download_preview_status(
            url=url,
            service_role_key=service_role_key,
            bucket=settings.storage_bucket,
            course_content_id=base_record.id,
        )
        source_type = base_record.source_type or _detect_source_type(base_record.material_name)
        preview_status = preview_status_payload.get("preview_status", base_record.preview_status)
        preview_count = preview_status_payload.get("preview_count", base_record.preview_count)
        if preview_status not in {"pending", "ready", "failed"}:
            preview_status = base_record.preview_status
        if not isinstance(preview_count, int):
            preview_count = base_record.preview_count

        materials.append(
            ProjectMaterialRecord.model_validate(
                {
                    **base_record.model_dump(),
                    "source_type": source_type,
                    "preview_status": preview_status,
                    "preview_count": preview_count,
                    "uploaded_at": link.get("created_at"),
                }
            )
        )

    return materials


def _assert_course_content_owned_by_username(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
    owner_user_id: str,
) -> None:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/project_materials"
        f"?material_id=eq.{course_content_id}&select=project_id"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "project_materials")

    for row in rows:
        project_id = _read_optional_int(row, "project_id")
        if project_id is None:
            continue
        try:
            _fetch_owned_project_row(
                url=url,
                service_role_key=service_role_key,
                project_id=project_id,
                owner_user_id=owner_user_id,
            )
            return
        except ProjectNotFoundError:
            continue

    raise ProjectNotFoundError("Course content was not found.")


def _assert_materials_linked_to_project(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    material_ids: list[int],
) -> None:
    project_material_links = _fetch_project_material_links(
        url=url,
        service_role_key=service_role_key,
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
    url: str,
    service_role_key: str,
    material_ids: list[int],
) -> dict[int, dict[str, Any]]:
    encoded_ids = ",".join(str(material_id) for material_id in material_ids)
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/course_contents"
        f"?id=in.({encoded_ids})&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "course_contents")
    records_by_id: dict[int, dict[str, Any]] = {}

    for row in rows:
        row_id = _read_optional_int(row, "id")
        if row_id is not None:
            records_by_id[row_id] = row

    return records_by_id


def _fetch_generated_material_rows_for_project_uuid(
    *,
    url: str,
    service_role_key: str,
    project_uuid: str,
    tool_type: str | None = None,
) -> list[dict[str, Any]]:
    filters = [f"project_uuid=eq.{parse.quote(project_uuid, safe='')}"]
    if tool_type:
        filters.append(f"tool_type=eq.{parse.quote(tool_type, safe='')}")

    query = "&".join(
        [
            *filters,
            "select=*",
            "order=created_at.desc,id.desc",
        ]
    )
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/generated_materials"
        f"?{query}"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    return _decode_json_rows(response_body, "generated_materials")


def _fetch_generated_material_row_by_uuid_for_project(
    *,
    url: str,
    service_role_key: str,
    project_uuid: str,
    generated_material_uuid: str,
) -> dict[str, Any]:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/generated_materials"
        f"?project_uuid=eq.{parse.quote(project_uuid, safe='')}"
        f"&uuid=eq.{parse.quote(generated_material_uuid, safe='')}"
        "&select=*"
        "&limit=1"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "generated_materials")
    if not rows:
        raise GeneratedMaterialNotFoundError("Generated material was not found.")

    return rows[0]


def _insert_generated_material_record(
    *,
    url: str,
    service_role_key: str,
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
    payload_map: dict[str, Any] = {
        "project_uuid": project_uuid,
        "name": name,
        "file_location": file_location,
        "tool_type": tool_type,
        "source_material_ids": source_material_ids,
        "payload": payload,
        "input_token": input_token,
        "output_token": output_token,
    }
    if uuid:
        payload_map["uuid"] = uuid

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/generated_materials",
        method="POST",
        data=json.dumps(payload_map).encode("utf-8"),
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 201},
    )
    rows = _decode_json_rows(response_body, "generated_materials")
    if not rows:
        raise SupabaseServiceError("Supabase did not return the inserted generated_materials row.")

    return GeneratedMaterialRecord.model_validate(rows[0])


def _read_latest_project_material_timestamp(material_links: list[dict[str, Any]]) -> Any:
    if not material_links:
        return None

    return material_links[0].get("created_at")


def _upload_storage_object(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    endpoint = _build_storage_endpoint(url=url, bucket=bucket, storage_path=storage_path)
    _send_request(
        endpoint=endpoint,
        method="POST",
        data=file_bytes,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": content_type,
            "x-upsert": "false",
        },
        expected_statuses={200, 201},
    )


def _upload_or_replace_storage_object(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    endpoint = _build_storage_endpoint(url=url, bucket=bucket, storage_path=storage_path)
    _send_request(
        endpoint=endpoint,
        method="POST",
        data=file_bytes,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        expected_statuses={200, 201},
    )


def _insert_course_content_record(
    *,
    url: str,
    service_role_key: str,
    filename: str,
    access_url: str,
    data_size: int,
    project_id: int,
    content_sha256: str,
) -> CourseContentRecord:
    payload = json.dumps(
        {
            "material_name": filename,
            "access_url": access_url,
            "data_size": data_size,
            "project_id": project_id,
            "content_sha256": content_sha256,
            "rag_status": "pending",
            "rag_chunk_count": 0,
            "rag_error": None,
        }
    ).encode("utf-8")

    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/course_contents",
        method="POST",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 201},
    )

    try:
        inserted_rows = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable course_contents response.") from exc

    if not isinstance(inserted_rows, list) or not inserted_rows:
        raise SupabaseServiceError("Supabase did not return the inserted course_contents row.")

    return CourseContentRecord.model_validate(inserted_rows[0])


def _fetch_course_content_record(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
) -> CourseContentRecord:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/course_contents"
        f"?id=eq.{course_content_id}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    try:
        rows = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable course content response.") from exc

    if not isinstance(rows, list) or not rows:
        raise SupabaseServiceError(f"Course content {course_content_id} was not found.")

    return CourseContentRecord.model_validate(rows[0])


def _update_course_content_record_name(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
    material_name: str,
) -> CourseContentRecord:
    payload = json.dumps({"material_name": material_name}).encode("utf-8")
    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/course_contents?id=eq.{course_content_id}",
        method="PATCH",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
        expected_statuses={200, 204},
    )
    rows = _decode_json_rows(response_body, "course_contents") if response_body else []
    if not rows:
        raise ProjectNotFoundError("Course content was not found.")

    return CourseContentRecord.model_validate(rows[0])


def _fetch_course_content_record_optional(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
) -> CourseContentRecord | None:
    endpoint = (
        f"{url.rstrip('/')}/rest/v1/course_contents"
        f"?id=eq.{course_content_id}&select=*"
    )
    response_body = _send_request(
        endpoint=endpoint,
        method="GET",
        headers={
            **_build_auth_headers(service_role_key),
            "Accept": "application/json",
        },
        expected_statuses={200},
    )

    try:
        rows = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Supabase returned an unreadable course content response.") from exc

    if not isinstance(rows, list) or not rows:
        return None

    return CourseContentRecord.model_validate(rows[0])


def _delete_storage_object(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    storage_path: str,
) -> Optional[str]:
    endpoint = _build_storage_endpoint(url=url, bucket=bucket, storage_path=storage_path)

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers=_build_auth_headers(service_role_key),
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _delete_storage_object_if_exists(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    storage_path: str,
) -> Optional[str]:
    endpoint = _build_storage_endpoint(url=url, bucket=bucket, storage_path=storage_path)

    try:
        _send_request_optional(
            endpoint=endpoint,
            method="DELETE",
            headers=_build_auth_headers(service_role_key),
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _delete_course_content_record(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
) -> Optional[str]:
    endpoint = f"{url.rstrip('/')}/rest/v1/course_contents?id=eq.{course_content_id}"

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers={
                **_build_auth_headers(service_role_key),
                "Accept": "application/json",
            },
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
        return str(exc)

    return None


def _update_course_content_rag_status(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
    rag_status: Literal["pending", "ready", "failed"],
    rag_chunk_count: int,
    rag_error: str | None,
) -> None:
    payload = json.dumps(
        {
            "rag_status": rag_status,
            "rag_chunk_count": rag_chunk_count,
            "rag_error": rag_error,
        }
    ).encode("utf-8")

    _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/course_contents?id=eq.{course_content_id}",
        method="PATCH",
        data=payload,
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200, 204},
    )


def _replace_course_content_chunks(
    *,
    url: str,
    service_role_key: str,
    project_id: int,
    course_content_id: int,
    material_name: str,
    embedded_chunks: list[EmbeddedTextChunk],
) -> None:
    delete_error = _delete_course_content_chunks(
        url=url,
        service_role_key=service_role_key,
        course_content_id=course_content_id,
    )
    if delete_error:
        raise SupabaseServiceError(delete_error)

    if not embedded_chunks:
        return

    rows = [
        {
            "project_id": project_id,
            "course_content_id": course_content_id,
            "material_name": material_name,
            "chunk_index": embedded_chunk.chunk.index,
            "text": embedded_chunk.chunk.text,
            "start_char": embedded_chunk.chunk.start_char,
            "end_char": embedded_chunk.chunk.end_char,
            "location_kind": embedded_chunk.chunk.location_kind,
            "location_start": embedded_chunk.chunk.location_start,
            "location_end": embedded_chunk.chunk.location_end,
            "embedding": _format_vector(embedded_chunk.embedding),
        }
        for embedded_chunk in embedded_chunks
    ]

    _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/course_content_chunks",
        method="POST",
        data=json.dumps(rows).encode("utf-8"),
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200, 201},
    )


def _delete_course_content_chunks(
    *,
    url: str,
    service_role_key: str,
    course_content_id: int,
) -> Optional[str]:
    endpoint = f"{url.rstrip('/')}/rest/v1/course_content_chunks?course_content_id=eq.{course_content_id}"

    try:
        _send_request(
            endpoint=endpoint,
            method="DELETE",
            headers={
                **_build_auth_headers(service_role_key),
                "Accept": "application/json",
            },
            expected_statuses={200, 204},
        )
    except SupabaseServiceError as exc:
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
    url: str,
    service_role_key: str,
    project_id: int,
    query_embedding: list[float],
    selected_material_ids: list[int],
    match_count: int,
) -> list[RagRetrievedChunk]:
    if not selected_material_ids:
        return _match_course_content_chunks(
            url=url,
            service_role_key=service_role_key,
            project_id=project_id,
            query_embedding=query_embedding,
            selected_material_id=None,
            match_count=match_count,
        )

    if len(selected_material_ids) == 1:
        return _match_course_content_chunks(
            url=url,
            service_role_key=service_role_key,
            project_id=project_id,
            query_embedding=query_embedding,
            selected_material_id=selected_material_ids[0],
            match_count=match_count,
        )

    chunk_by_key: dict[tuple[int, int], RagRetrievedChunk] = {}

    for material_id in selected_material_ids:
        material_chunks = _match_course_content_chunks(
            url=url,
            service_role_key=service_role_key,
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
    url: str,
    service_role_key: str,
    project_id: int,
    query_embedding: list[float],
    selected_material_id: int | None,
    match_count: int,
) -> list[RagRetrievedChunk]:
    payload = {
        "query_embedding": _format_vector(query_embedding),
        "filter_project_id": project_id,
        "match_count": match_count,
        "filter_material_id": selected_material_id,
    }
    response_body = _send_request(
        endpoint=f"{url.rstrip('/')}/rest/v1/rpc/match_course_content_chunks",
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            **_build_auth_headers(service_role_key),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        expected_statuses={200},
    )
    rows = _decode_json_rows(response_body, "course_content_chunks")
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
    url: str,
    service_role_key: str,
    bucket: str,
    course_content_id: int,
    manifest: CourseContentPreviewManifest,
) -> None:
    _upload_or_replace_storage_object(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
        storage_path=_build_preview_manifest_storage_path(course_content_id=course_content_id),
        file_bytes=manifest.model_dump_json().encode("utf-8"),
        content_type="application/json",
    )


def _upload_preview_status(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
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
    _upload_or_replace_storage_object(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
        storage_path=_build_preview_status_storage_path(course_content_id=course_content_id),
        file_bytes=json.dumps(payload).encode("utf-8"),
        content_type="application/json",
    )


def _download_preview_manifest(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    course_content_id: int,
) -> CourseContentPreviewManifest | None:
    response_body = _download_storage_object_optional(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
        storage_path=_build_preview_manifest_storage_path(course_content_id=course_content_id),
    )
    if response_body is None:
        return None

    try:
        payload = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Stored preview manifest is unreadable.") from exc

    return CourseContentPreviewManifest.model_validate(payload)


def _download_preview_status(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    course_content_id: int,
) -> dict[str, Any]:
    response_body = _download_storage_object_optional(
        url=url,
        service_role_key=service_role_key,
        bucket=bucket,
        storage_path=_build_preview_status_storage_path(course_content_id=course_content_id),
    )
    if response_body is None:
        return {}

    try:
        payload = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError("Stored preview status is unreadable.") from exc

    return payload if isinstance(payload, dict) else {}


def _build_preview_manifest_from_status_payload(
    preview_status_payload: dict[str, Any],
) -> CourseContentPreviewManifest | None:
    course_content_id = preview_status_payload.get("course_content_id")
    material_name = preview_status_payload.get("material_name")
    access_url = preview_status_payload.get("access_url")
    source_type = preview_status_payload.get("source_type")
    preview_status = preview_status_payload.get("preview_status", "pending")
    preview_count = preview_status_payload.get("preview_count", 0)
    preview_error = preview_status_payload.get("preview_error")

    if not isinstance(course_content_id, int):
        return None
    if not isinstance(material_name, str) or not material_name.strip():
        return None
    if not isinstance(access_url, str) or not access_url.strip():
        return None
    if source_type not in {"pdf", "docx", "pptx"}:
        return None
    if preview_status not in {"pending", "ready", "failed"}:
        return None
    if not isinstance(preview_count, int):
        preview_count = 0

    return CourseContentPreviewManifest(
        course_content_id=course_content_id,
        material_name=material_name,
        source_type=source_type,
        preview_status=preview_status,
        preview_count=preview_count,
        access_url=access_url,
        preview_error=preview_error if isinstance(preview_error, str) else None,
        items=[],
    )


def _build_auth_headers(service_role_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }


def _build_storage_endpoint(*, url: str, bucket: str, storage_path: str) -> str:
    quoted_bucket = parse.quote(bucket, safe="")
    quoted_path = parse.quote(storage_path, safe="/")
    return f"{url.rstrip('/')}/storage/v1/object/{quoted_bucket}/{quoted_path}"


def _build_object_url(*, url: str, bucket: str, storage_path: str) -> str:
    quoted_bucket = parse.quote(bucket, safe="")
    quoted_path = parse.quote(storage_path, safe="/")
    return f"{url.rstrip('/')}/storage/v1/object/{quoted_bucket}/{quoted_path}"


def _extract_storage_path_from_access_url(*, access_url: str, bucket: str) -> str | None:
    parsed_url = parse.urlparse(access_url)
    normalized_bucket = parse.quote(bucket, safe="")
    expected_prefix = f"/storage/v1/object/{normalized_bucket}/"

    if not parsed_url.path.startswith(expected_prefix):
        return None

    encoded_path = parsed_url.path.removeprefix(expected_prefix)
    if not encoded_path:
        return None

    return parse.unquote(encoded_path)


def _download_storage_object_optional(
    *,
    url: str,
    service_role_key: str,
    bucket: str,
    storage_path: str,
) -> bytes | None:
    endpoint = _build_storage_endpoint(url=url, bucket=bucket, storage_path=storage_path)
    return _send_request_optional(
        endpoint=endpoint,
        method="GET",
        headers=_build_auth_headers(service_role_key),
        expected_statuses={200},
    )


def _send_request(
    *,
    endpoint: str,
    method: str,
    headers: dict[str, str],
    expected_statuses: set[int],
    data: Optional[bytes] = None,
) -> bytes:
    api_request = request.Request(
        url=endpoint,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with request.urlopen(api_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
            response_body = response.read()
    except error.HTTPError as exc:
        response_body = exc.read()
        message = _extract_error_message(response_body)
        raise SupabaseServiceError(f"Supabase request failed with status {exc.code}: {message}") from exc
    except error.URLError as exc:
        raise SupabaseServiceError(f"Supabase request failed: {exc.reason}") from exc

    if status_code not in expected_statuses:
        raise SupabaseServiceError(
            f"Supabase request returned unexpected status {status_code}."
        )

    return response_body


def _send_request_optional(
    *,
    endpoint: str,
    method: str,
    headers: dict[str, str],
    expected_statuses: set[int],
    data: Optional[bytes] = None,
) -> bytes | None:
    api_request = request.Request(
        url=endpoint,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with request.urlopen(api_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
            response_body = response.read()
    except error.HTTPError as exc:
        response_body = exc.read()
        if exc.code == 404:
            logger.info(
                "Optional Supabase object missing via HTTP 404 for endpoint=%s",
                endpoint,
            )
            return None
        if _is_missing_storage_object_error(status_code=exc.code, response_body=response_body):
            logger.info(
                "Optional Supabase object missing via normalized %s for endpoint=%s",
                exc.code,
                endpoint,
            )
            return None

        message = _extract_error_message(response_body)
        raise SupabaseServiceError(f"Supabase request failed with status {exc.code}: {message}") from exc
    except error.URLError as exc:
        raise SupabaseServiceError(f"Supabase request failed: {exc.reason}") from exc

    if status_code not in expected_statuses:
        raise SupabaseServiceError(
            f"Supabase request returned unexpected status {status_code}."
        )

    return response_body


def _detect_source_type(filename: str) -> SourceType:
    suffix = os.path.splitext(filename)[1].lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"

    raise SupabaseServiceError("Unsupported source type.")


def _is_missing_storage_object_error(*, status_code: int, response_body: bytes) -> bool:
    if status_code != 400 or not response_body:
        return False

    try:
        payload: Any = json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError:
        return False

    if not isinstance(payload, dict):
        return False

    status_value = payload.get("statusCode")
    error_value = payload.get("error")
    message_value = payload.get("message")

    status_text = str(status_value).strip().lower() if status_value is not None else ""
    error_text = error_value.strip().lower() if isinstance(error_value, str) else ""
    message_text = message_value.strip().lower() if isinstance(message_value, str) else ""

    return (
        status_text == "404"
        or error_text == "not_found"
        or message_text == "object not found"
    )


def _decode_json_payload(response_body: bytes, label: str) -> Any:
    try:
        return json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SupabaseServiceError(f"Supabase returned an unreadable {label} response.") from exc


def _decode_json_rows(response_body: bytes, label: str) -> list[dict[str, Any]]:
    payload = _decode_json_payload(response_body, label)

    if not isinstance(payload, list):
        raise SupabaseServiceError(f"Supabase did not return valid {label} rows.")

    return [row for row in payload if isinstance(row, dict)]


def _read_int(row: dict[str, Any], field: str) -> int:
    value = _read_optional_int(row, field)
    if value is None:
        raise SupabaseServiceError(f"Supabase row is missing integer field {field}.")

    return value


def _read_optional_int(row: dict[str, Any], field: str) -> int | None:
    value = row.get(field)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)

    return None


def _extract_error_message(response_body: bytes) -> str:
    if not response_body:
        return "No additional details returned."

    decoded_body = response_body.decode("utf-8", errors="replace").strip()
    try:
        payload: Any = json.loads(decoded_body)
    except json.JSONDecodeError:
        return decoded_body

    if isinstance(payload, dict):
        for field in ("message", "error_description", "error", "details", "hint"):
            value = payload.get(field)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return decoded_body
