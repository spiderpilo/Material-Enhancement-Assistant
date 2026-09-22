"""
Apply pending SQL migrations to Neon Postgres and record them in public.schema_migrations.

Only migrations dated on or after the Neon baseline (BASELINE_PREFIX) are managed;
earlier files are already folded into backend/database/neon/schema.sql. Every
managed migration must be idempotent (IF NOT EXISTS / guarded DO blocks), so a
run that dies between applying a file and recording it is safe to repeat.

Connects with DIRECT_URL (falling back to DATABASE_URL) and refuses Neon pooled
("-pooler") hosts: the session advisory lock that serializes concurrent runs
does not survive PgBouncer transaction pooling.

Usage:
  backend/.venv/bin/python backend/database/migrate.py --dry-run
  backend/.venv/bin/python backend/database/migrate.py
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2


BACKEND_DIR = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = BACKEND_DIR / "database" / "migrations"
BASELINE_PREFIX = "20260922"
# Arbitrary constant shared by every runner so only one applies migrations at a time.
ADVISORY_LOCK_ID = 7_310_922_001


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Migration:
    filename: str
    sql: str

    @property
    def checksum(self) -> str:
        return hashlib.sha256(self.sql.encode()).hexdigest()


def load_migrations(directory: Path = MIGRATIONS_DIR) -> list[Migration]:
    return [
        Migration(filename=path.name, sql=path.read_text())
        for path in sorted(directory.glob("*.sql"))
        if path.name >= BASELINE_PREFIX
    ]


def run(dsn: str, migrations: list[Migration], *, dry_run: bool = False) -> list[str]:
    """Apply migrations not yet recorded; return the filenames applied (or pending, on dry run)."""
    connection = psycopg2.connect(dsn, connect_timeout=15)
    connection.autocommit = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", (ADVISORY_LOCK_ID,))
            try:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.schema_migrations (
                        filename text PRIMARY KEY,
                        checksum text NOT NULL,
                        applied_at timestamptz NOT NULL DEFAULT now()
                    )
                    """
                )
                cursor.execute("SELECT filename, checksum FROM public.schema_migrations")
                applied = dict(cursor.fetchall())

                changed = [m.filename for m in migrations if m.filename in applied and applied[m.filename] != m.checksum]
                if changed:
                    raise MigrationError(
                        "Applied migrations were edited after they ran: "
                        + ", ".join(changed)
                        + ". Add a new migration instead of changing an applied one."
                    )

                pending = [m for m in migrations if m.filename not in applied]
                if dry_run:
                    return [m.filename for m in pending]

                for migration in pending:
                    print(f"Applying {migration.filename}", flush=True)
                    # Files manage their own BEGIN/COMMIT; recording happens after they commit.
                    cursor.execute(migration.sql)
                    cursor.execute(
                        "INSERT INTO public.schema_migrations (filename, checksum) VALUES (%s, %s)",
                        (migration.filename, migration.checksum),
                    )
                return [m.filename for m in pending]
            finally:
                cursor.execute("SELECT pg_advisory_unlock(%s)", (ADVISORY_LOCK_ID,))
    finally:
        connection.close()


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _get_dsn() -> str:
    dsn = (os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not dsn:
        raise MigrationError("DIRECT_URL (or DATABASE_URL) is not set.")
    host = urlsplit(dsn).hostname or ""
    if "-pooler" in host:
        raise MigrationError("Refusing a pooled Neon host; set DIRECT_URL to the direct (non -pooler) connection.")
    return dsn


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="List pending migrations without applying them")
    args = parser.parse_args(argv)

    _load_env_file(BACKEND_DIR.parent / ".env")
    try:
        filenames = run(_get_dsn(), load_migrations(), dry_run=args.dry_run)
    except (MigrationError, psycopg2.Error) as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1

    if not filenames:
        print("No pending migrations.")
    elif args.dry_run:
        print("Pending migrations:\n" + "\n".join(f"  {name}" for name in filenames))
    else:
        print(f"Applied {len(filenames)} migration(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
