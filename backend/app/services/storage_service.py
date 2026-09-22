"""S3-compatible object storage (Cloudflare R2, AWS S3, MinIO, ...).

Replaces Supabase Storage. Object keys are unchanged from the Supabase bucket
(``course-contents/<uuid>/<file>``, ``course-content-previews/<id>/...``,
``generated-materials/...``). The bucket must be publicly readable at
``STORAGE_PUBLIC_URL`` because the frontend loads previews and downloads directly.
"""

from __future__ import annotations

import re
from functools import lru_cache
from urllib import parse

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import StorageSettings, get_storage_settings
from app.services.errors import DataServiceError, MissingConfigError


CONNECT_TIMEOUT_SECONDS = 10
READ_TIMEOUT_SECONDS = 30
MISSING_OBJECT_ERROR_CODES = {"404", "NoSuchKey", "NotFound"}
LEGACY_SUPABASE_OBJECT_PATH = re.compile(r"^/storage/v1/object/(?:public/)?[^/]+/(?P<key>.+)$")


def put_object(*, key: str, body: bytes, content_type: str) -> None:
    settings = _get_settings()
    try:
        _get_client(settings).put_object(
            Bucket=settings.bucket,
            Key=key,
            Body=body,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        raise DataServiceError(f"Storage upload failed for {key}: {exc}") from exc


def get_object_optional(*, key: str) -> bytes | None:
    settings = _get_settings()
    try:
        response = _get_client(settings).get_object(Bucket=settings.bucket, Key=key)
        return response["Body"].read()
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in MISSING_OBJECT_ERROR_CODES:
            return None
        raise DataServiceError(f"Storage download failed for {key}: {exc}") from exc
    except BotoCoreError as exc:
        raise DataServiceError(f"Storage download failed for {key}: {exc}") from exc


def head_object_optional(*, key: str) -> dict[str, object] | None:
    """Return content type and size of an object, or None when it does not exist."""
    settings = _get_settings()
    try:
        response = _get_client(settings).head_object(Bucket=settings.bucket, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in MISSING_OBJECT_ERROR_CODES:
            return None
        raise DataServiceError(f"Storage lookup failed for {key}: {exc}") from exc
    except BotoCoreError as exc:
        raise DataServiceError(f"Storage lookup failed for {key}: {exc}") from exc

    return {"content_type": response.get("ContentType"), "content_length": response.get("ContentLength")}


def delete_object(*, key: str) -> None:
    """Delete an object. S3 deletes are idempotent, so a missing key is not an error."""
    settings = _get_settings()
    try:
        _get_client(settings).delete_object(Bucket=settings.bucket, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in MISSING_OBJECT_ERROR_CODES:
            return
        raise DataServiceError(f"Storage delete failed for {key}: {exc}") from exc
    except BotoCoreError as exc:
        raise DataServiceError(f"Storage delete failed for {key}: {exc}") from exc


def build_public_url(*, key: str) -> str:
    settings = _get_settings()
    return f"{settings.public_url}/{parse.quote(key, safe='/')}"


def extract_key_from_url(url: str) -> str | None:
    """Return the object key for a public URL, including legacy Supabase object URLs."""
    settings = _get_settings()
    public_prefix = f"{settings.public_url}/"
    if url.startswith(public_prefix):
        encoded_key = url.removeprefix(public_prefix).split("?", 1)[0]
        return parse.unquote(encoded_key) or None

    parsed_url = parse.urlparse(url)
    legacy_match = LEGACY_SUPABASE_OBJECT_PATH.match(parsed_url.path)
    if legacy_match:
        return parse.unquote(legacy_match.group("key")) or None

    return None


def _get_settings() -> StorageSettings:
    try:
        return get_storage_settings()
    except ValueError as exc:
        raise MissingConfigError(str(exc)) from exc


@lru_cache(maxsize=4)
def _get_client(settings: StorageSettings):
    return boto3.client(
        "s3",
        endpoint_url=settings.endpoint_url,
        region_name=settings.region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        config=Config(
            connect_timeout=CONNECT_TIMEOUT_SECONDS,
            read_timeout=READ_TIMEOUT_SECONDS,
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path" if settings.endpoint_url else "auto"},
        ),
    )
