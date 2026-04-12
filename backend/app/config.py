import os
from pathlib import Path

from dotenv import load_dotenv
from datetime import timedelta

from sqlalchemy import create_engine

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_ENV_VARS = (
    "GOOGLE_GEMINI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
)


# def get_gemini_api_key() -> str | None:
#     for env_var in GEMINI_ENV_VARS:
#         value = os.getenv(env_var)
#         if value:
#             return value
#     return None


# from sqlalchemy.pool import NullPool


def _get_db_env_value(*names: str):
    for name in names:
        value = os.getenv(name)
        if value:
            value = value.strip()
            if value:
                return value
    return None

def get_database_engine():
    DATABASE_URL = _get_db_env_value("DATABASE_URL")

    if not DATABASE_URL:
        USER = _get_db_env_value("DATABASE_USER", "DB_USER", "user")
        PASSWORD = _get_db_env_value("DATABASE_PASSWORD", "DB_PASSWORD", "password")
        HOST = _get_db_env_value("DATABASE_HOST", "DB_HOST", "host")
        PORT = _get_db_env_value("DATABASE_PORT", "DB_PORT", "port")
        DBNAME = _get_db_env_value("DATABASE_NAME", "DB_NAME", "dbname")

        if all([USER, PASSWORD, HOST, PORT, DBNAME]):
            DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

    engine = create_engine(DATABASE_URL) if DATABASE_URL else None
    return engine
print(False if get_database_engine() is None else "a")
# Database Configuration
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = True  # Set to False in production


# Application Configuration
# DEBUG = os.getenv('DEBUG', True)
# TESTING = os.getenv('TESTING', False)
