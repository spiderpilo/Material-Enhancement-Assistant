import json
import logging
import mimetypes
import os
from dataclasses import dataclass
from typing import Any, Optional
from urllib import error, parse, request
from uuid import uuid4

from app.config import get_supabase_settings
from app.models.account_model import CreateAccountResponse, LoginAccountResponse, UserProfileRecord
from app.models.document_model import (
    CourseContentPreviewItem,
    CourseContentPreviewManifest,
    CourseContentRecord,
    PreviewStatus,
    SourceType,
)
from app.models.project_model import ProjectMaterialRecord, ProjectRecord, ProjectSummary
from app.models.quiz_model import QuizSourceMaterial
from app.services.parser_service import DocumentParseError, parse_document
from app.services.preview_service import DocumentPreviewError, render_course_content_previews
from app.utils.file_utils import sanitize_filename


REQUEST_TIMEOUT_SECONDS = 30
PREVIEW_STORAGE_PREFIX = "course-content-previews"
logger = logging.getLogger(__name__)


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


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str
    username: str
    profession: str


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

    project_row = _insert_project_record(
        url=settings.url,
        service_role_key=settings.service_role_key,
        name=name,
        owner_user_id=auth_user.user_id,
    )

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


def get_course_content_texts_for_user(
    *,
    access_token: str,
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

    for material_id in unique_material_ids:
        _assert_course_content_owned_by_username(
            url=settings.url,
            service_role_key=settings.service_role_key,
            course_content_id=material_id,
            owner_auth_user_id=auth_user.user_id,
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


def _build_storage_path(filename: str) -> str:
    sanitized_filename = sanitize_filename(filename)
    return f"course-contents/{uuid4()}/{sanitized_filename}"


def _build_preview_manifest_storage_path(*, course_content_id: int) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/manifest.json"


def _build_preview_status_storage_path(*, course_content_id: int) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/status.json"


def _build_preview_item_storage_path(*, course_content_id: int, image_name: str) -> str:
    return f"{PREVIEW_STORAGE_PREFIX}/{course_content_id}/{image_name}"


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
) -> dict[str, Any]:
    payload = json.dumps(
        {
            "name": name,
            "owner_user_id": owner_user_id,
        }
    ).encode("utf-8")

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
) -> CourseContentRecord:
    payload = json.dumps(
        {
            "material_name": filename,
            "access_url": access_url,
            "data_size": data_size,
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
