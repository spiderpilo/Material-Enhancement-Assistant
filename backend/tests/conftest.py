"""Shared fixtures for backend tests.

Integration tests run against a throwaway Postgres (with pgvector) given by
``TEST_DATABASE_URL`` — never the dev/prod Neon database. Start one with::

    backend/scripts/test_db.sh start

Storage is replaced with an in-memory fake so tests never touch the real bucket.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Iterator

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()
TEST_PUBLIC_URL = "https://storage.test/test-bucket"

# Must be set before app.config runs load_dotenv(); load_dotenv never overrides
# variables that are already present, so the repo .env cannot leak into tests.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL or "postgresql://unset.invalid/unset"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["JWT_ACCESS_TOKEN_TTL_SECONDS"] = "900"
os.environ["JWT_REFRESH_TOKEN_TTL_SECONDS"] = "86400"
os.environ["S3_BUCKET"] = "test-bucket"
os.environ["S3_ENDPOINT_URL"] = "https://storage.test"
os.environ["S3_REGION"] = "auto"
os.environ["S3_ACCESS_KEY_ID"] = "test"
os.environ["S3_SECRET_ACCESS_KEY"] = "test"
os.environ["STORAGE_PUBLIC_URL"] = TEST_PUBLIC_URL
# Empty values win over .env and read as "not configured", so no test can call Gemini.
for gemini_env_var in ("GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
    os.environ[gemini_env_var] = ""

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.services import db, storage_service  # noqa: E402


SCHEMA_FILE = BACKEND_DIR / "database" / "neon" / "schema.sql"
MIGRATIONS_AFTER_SCHEMA = sorted(
    path
    for path in (BACKEND_DIR / "database" / "migrations").glob("*.sql")
    if path.name >= "20260922"
)
DATA_TABLES = (
    "auth_sessions",
    "course_content_chunks",
    "project_chat_memory",
    "generated_materials",
    "project_materials",
    "user_projects",
    "course_contents",
    "projects",
    "users",
    "auth_users",
)


def _raw_connection():
    return psycopg2.connect(TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def database() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set; run backend/scripts/test_db.sh start")
    if "neon.tech" in TEST_DATABASE_URL:
        pytest.exit("Refusing to run destructive tests against a Neon database.", returncode=2)

    connection = _raw_connection()
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        cursor.execute(SCHEMA_FILE.read_text())
        for migration in MIGRATIONS_AFTER_SCHEMA:
            cursor.execute(migration.read_text())
    connection.close()
    return TEST_DATABASE_URL


@pytest.fixture()
def clean_db(database: str) -> Iterator[None]:
    connection = _raw_connection()
    connection.autocommit = True
    with connection.cursor() as cursor:
        existing = [table for table in DATA_TABLES if _table_exists(cursor, table)]
        cursor.execute(f"TRUNCATE {', '.join('public.' + t for t in existing)} RESTART IDENTITY CASCADE")
    connection.close()
    yield


def _table_exists(cursor, table: str) -> bool:
    cursor.execute("SELECT to_regclass(%s)", (f"public.{table}",))
    return cursor.fetchone()[0] is not None


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.get_calls = 0

    def put_object(self, *, key: str, body: bytes, content_type: str) -> None:
        self.objects[key] = (body, content_type)

    def get_object_optional(self, *, key: str) -> bytes | None:
        self.get_calls += 1
        entry = self.objects.get(key)
        return entry[0] if entry else None

    def delete_object(self, *, key: str) -> None:
        self.objects.pop(key, None)

    def head_object_optional(self, *, key: str) -> dict[str, Any] | None:
        entry = self.objects.get(key)
        if entry is None:
            return None
        return {"content_type": entry[1], "content_length": len(entry[0])}


@pytest.fixture()
def fake_storage(monkeypatch: pytest.MonkeyPatch) -> FakeStorage:
    storage = FakeStorage()
    for name in ("put_object", "get_object_optional", "delete_object", "head_object_optional"):
        monkeypatch.setattr(storage_service, name, getattr(storage, name), raising=False)
    return storage


class QueryCounter:
    def __init__(self) -> None:
        self.statements: list[str] = []

    @property
    def count(self) -> int:
        return len(self.statements)

    def reset(self) -> None:
        self.statements.clear()


@pytest.fixture()
def query_counter(monkeypatch: pytest.MonkeyPatch) -> QueryCounter:
    counter = QueryCounter()
    original_execute = psycopg2.extras.RealDictCursor.execute

    def counting_execute(self, query, vars=None):  # noqa: A002 - psycopg2 signature
        counter.statements.append(query if isinstance(query, str) else query.decode())
        return original_execute(self, query, vars)

    monkeypatch.setattr(psycopg2.extras.RealDictCursor, "execute", counting_execute)
    return counter


@pytest.fixture()
def client(clean_db: None, fake_storage: FakeStorage) -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, *, email: str = "prof@example.com", username: str = "prof") -> dict[str, Any]:
    response = client.post(
        "/create-account",
        json={"email": email, "username": username, "password": "correct-horse-1", "profession": "professor"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def _close_pool() -> Iterator[None]:
    yield
    if db._pool is not None:
        db._pool.closeall()
