import os
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


def get_gemini_api_key() -> str | None:
    for env_var in GEMINI_ENV_VARS:
        value = os.getenv(env_var)
        if value:
            return value
    return None
