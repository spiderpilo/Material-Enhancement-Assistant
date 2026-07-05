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
GEMINI_ENV_VARS = (
    "GOOGLE_GEMINI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
)


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    service_role_key: str
    storage_bucket: str


def get_gemini_api_key() -> str:
    for env_var in GEMINI_ENV_VARS:
        value = os.getenv(env_var)
        if value:
            return value
    return None


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


def get_supabase_settings() -> SupabaseSettings:
    return SupabaseSettings(
        url=_get_required_env("SUPABASE_URL"),
        service_role_key=_get_required_env("SUPABASE_SERVICE_ROLE_KEY"),
        storage_bucket=_get_required_env("SUPABASE_STORAGE_BUCKET"),
    )


def _get_required_env(env_var: str) -> str:
    value = os.getenv(env_var)
    if value is not None:
        normalized = value.strip()
        if normalized:
            return normalized
    raise ValueError(f"{env_var} is not set.")
