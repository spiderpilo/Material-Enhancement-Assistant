from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
DEFAULT_GEMINI_EMBEDDING_DIMENSIONS = 768


DEFAULT_JWT_ACCESS_TOKEN_TTL_SECONDS = 3600
DEFAULT_JWT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
MIN_JWT_SECRET_LENGTH = 32

DEFAULT_CORS_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
)


@dataclass(frozen=True)
class DatabaseSettings:
    url: str


@dataclass(frozen=True)
class StorageSettings:
    bucket: str
    public_url: str
    endpoint_url: str | None
    region: str
    access_key_id: str
    secret_access_key: str


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int


def get_gemini_api_key() -> str | None:
    value = os.getenv("GOOGLE_GEMINI_API_KEY")
    return value.strip() if value and value.strip() else None


def get_gemini_embedding_model() -> str:
    value = os.getenv("GEMINI_EMBEDDING_MODEL")
    return value.strip() if value and value.strip() else DEFAULT_GEMINI_EMBEDDING_MODEL


def get_gemini_embedding_dimensions() -> int:
    value = os.getenv("GEMINI_EMBEDDING_DIMENSIONS")
    if not value or not value.strip():
        return DEFAULT_GEMINI_EMBEDDING_DIMENSIONS

    try:
        dimensions = int(value)
    except ValueError:
        return DEFAULT_GEMINI_EMBEDDING_DIMENSIONS

    return dimensions if dimensions > 0 else DEFAULT_GEMINI_EMBEDDING_DIMENSIONS


def get_cors_allowed_origins() -> list[str]:
    """Comma-separated CORS_ALLOWED_ORIGINS; local frontend origins when unset."""
    value = os.getenv("CORS_ALLOWED_ORIGINS")
    if not value or not value.strip():
        return list(DEFAULT_CORS_ALLOWED_ORIGINS)

    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


def get_app_version() -> str:
    """Build identifier (git SHA) baked into the image; lets deploys verify what is live."""
    value = os.getenv("APP_VERSION")
    return value.strip() if value and value.strip() else "dev"


def get_database_settings() -> DatabaseSettings:
    return DatabaseSettings(url=_get_required_env("DATABASE_URL"))


def get_storage_settings() -> StorageSettings:
    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    return StorageSettings(
        bucket=_get_required_env("S3_BUCKET"),
        public_url=_get_required_env("STORAGE_PUBLIC_URL").rstrip("/"),
        endpoint_url=endpoint_url.strip() if endpoint_url and endpoint_url.strip() else None,
        region=(os.getenv("S3_REGION") or "auto").strip() or "auto",
        access_key_id=_get_required_env("S3_ACCESS_KEY_ID"),
        secret_access_key=_get_required_env("S3_SECRET_ACCESS_KEY"),
    )


def get_auth_settings() -> AuthSettings:
    jwt_secret = _get_required_env("JWT_SECRET")
    if len(jwt_secret) < MIN_JWT_SECRET_LENGTH:
        raise ValueError(f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters.")

    return AuthSettings(
        jwt_secret=jwt_secret,
        access_token_ttl_seconds=_get_positive_int_env(
            "JWT_ACCESS_TOKEN_TTL_SECONDS",
            DEFAULT_JWT_ACCESS_TOKEN_TTL_SECONDS,
        ),
        refresh_token_ttl_seconds=_get_positive_int_env(
            "JWT_REFRESH_TOKEN_TTL_SECONDS",
            DEFAULT_JWT_REFRESH_TOKEN_TTL_SECONDS,
        ),
    )


def _get_positive_int_env(env_var: str, default: int) -> int:
    value = os.getenv(env_var)
    if not value or not value.strip():
        return default

    try:
        parsed = int(value)
    except ValueError:
        return default

    return parsed if parsed > 0 else default


def _get_required_env(env_var: str) -> str:
    value = os.getenv(env_var)
    if value is not None:
        normalized = value.strip()
        if normalized:
            return normalized
    raise ValueError(f"{env_var} is not set.")
