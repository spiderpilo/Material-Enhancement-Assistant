import json
import mimetypes
import os
from typing import Any, Optional
from urllib import error, parse, request
from uuid import uuid4

from app.config import get_supabase_settings
from app.models.account_model import CreateAccountResponse, LoginAccountResponse, UserProfileRecord
from app.models.document_model import CourseContentRecord
from app.utils.file_utils import sanitize_filename


REQUEST_TIMEOUT_SECONDS = 30


class MissingSupabaseConfigError(Exception):
    """Raised when the backend is missing required Supabase settings."""


class SupabaseServiceError(Exception):
    """Raised when Supabase storage or database operations fail."""


class InvalidCredentialsError(SupabaseServiceError):
    """Raised when login credentials are invalid."""


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


def upload_course_content(*, filename: str, file_bytes: bytes) -> CourseContentRecord:
    try:
        settings = get_supabase_settings()
    except ValueError as exc:
        raise MissingSupabaseConfigError(str(exc)) from exc

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
        return _insert_course_content_record(
            url=settings.url,
            service_role_key=settings.service_role_key,
            filename=filename,
            access_url=access_url,
            data_size=len(file_bytes),
        )
    except SupabaseServiceError as exc:
        cleanup_error = _delete_storage_object(
            url=settings.url,
            service_role_key=settings.service_role_key,
            bucket=settings.storage_bucket,
            storage_path=storage_path,
        )
        if cleanup_error:
            raise SupabaseServiceError(f"{exc} Cleanup failed: {cleanup_error}") from exc
        raise


def _build_storage_path(filename: str) -> str:
    sanitized_filename = sanitize_filename(filename)
    return f"course-contents/{uuid4()}/{sanitized_filename}"


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
