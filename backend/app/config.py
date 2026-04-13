import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
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
