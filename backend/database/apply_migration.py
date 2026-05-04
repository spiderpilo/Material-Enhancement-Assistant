"""
Run a SQL migration file against Supabase Postgres.

Usage:
  backend/.venv/bin/python backend/database/apply_migration.py \
    backend/database/migrations/20260502_projects_uuid_contract.sql
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _get_connection_string() -> str:
    dsn = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DIRECT_URL or DATABASE_URL is missing in environment.")
    if "your-project-ref" in dsn or "your-password" in dsn:
        raise RuntimeError(
            "DIRECT_URL/DATABASE_URL still contains placeholder values. "
            "Set real Supabase connection values before running migrations."
        )
    return dsn


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: apply_migration.py <migration.sql>")
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    _load_env_file(repo_root / ".env")

    migration_path = Path(sys.argv[1]).resolve()
    if not migration_path.exists():
        print(f"Migration file not found: {migration_path}")
        return 1

    sql_text = migration_path.read_text()
    dsn = _get_connection_string()

    with psycopg2.connect(dsn) as connection:
        connection.autocommit = False
        with connection.cursor() as cursor:
            cursor.execute(sql_text)
        connection.commit()

    print(f"Applied migration: {migration_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
