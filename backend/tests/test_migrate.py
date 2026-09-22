from __future__ import annotations

import sys

import psycopg2
import pytest

from tests.conftest import BACKEND_DIR

sys.path.insert(0, str(BACKEND_DIR / "database"))

import migrate  # noqa: E402


@pytest.fixture()
def fresh_tracking(database: str) -> str:
    connection = psycopg2.connect(database)
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS public.schema_migrations")
    connection.close()
    return database


def test_repo_migrations_apply_and_are_recorded_once(fresh_tracking: str):
    migrations = migrate.load_migrations()
    assert migrations, "expected post-baseline migrations"
    assert all(m.filename >= migrate.BASELINE_PREFIX for m in migrations)

    # The session schema already has them, so this also proves they are idempotent.
    assert migrate.run(fresh_tracking, migrations) == [m.filename for m in migrations]
    assert migrate.run(fresh_tracking, migrations) == []
    assert migrate.run(fresh_tracking, migrations, dry_run=True) == []


def test_dry_run_applies_nothing(fresh_tracking: str):
    migration = migrate.Migration("29990101_probe.sql", "CREATE TABLE public.migrate_probe (id int);")

    assert migrate.run(fresh_tracking, [migration], dry_run=True) == ["29990101_probe.sql"]

    connection = psycopg2.connect(fresh_tracking)
    with connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass('public.migrate_probe')")
        assert cursor.fetchone()[0] is None
    connection.close()


def test_edited_applied_migration_is_rejected(fresh_tracking: str):
    original = migrate.Migration("29990102_probe.sql", "SELECT 1;")
    migrate.run(fresh_tracking, [original])

    with pytest.raises(migrate.MigrationError, match="29990102_probe.sql"):
        migrate.run(fresh_tracking, [migrate.Migration("29990102_probe.sql", "SELECT 2;")])


def test_pooled_neon_host_is_refused(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DIRECT_URL", "postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=require")

    with pytest.raises(migrate.MigrationError, match="pooled"):
        migrate._get_dsn()
