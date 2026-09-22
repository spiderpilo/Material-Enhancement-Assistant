from __future__ import annotations

import logging
import threading
import time
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterator, Sequence
from uuid import UUID

import psycopg2
import psycopg2.extras
import psycopg2.pool

from app.config import get_database_settings
from app.services.errors import DataServiceError, MissingConfigError


logger = logging.getLogger(__name__)

POOL_MIN_CONNECTIONS = 1
POOL_MAX_CONNECTIONS = 10
CONNECT_TIMEOUT_SECONDS = 10
# Neon suspends idle computes after ~5 minutes and drops their connections. A
# connection returned to the pool within this window is reused without a
# liveness round trip; older ones are checked first.
IDLE_PING_AFTER_SECONDS = 30

_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()
_last_returned_at: dict[int, float] = {}


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool

    if _pool is not None:
        return _pool

    with _pool_lock:
        if _pool is None:
            try:
                settings = get_database_settings()
            except ValueError as exc:
                raise MissingConfigError(str(exc)) from exc

            try:
                _pool = psycopg2.pool.ThreadedConnectionPool(
                    POOL_MIN_CONNECTIONS,
                    POOL_MAX_CONNECTIONS,
                    dsn=settings.url,
                    connect_timeout=CONNECT_TIMEOUT_SECONDS,
                )
            except psycopg2.Error as exc:
                raise DataServiceError(f"Database connection failed: {_format_pg_error(exc)}") from exc

    return _pool


@contextmanager
def transaction() -> Iterator[psycopg2.extras.RealDictCursor]:
    """Yield a dict cursor inside one transaction; commit on success, roll back on error.

    Use for multi-statement writes that must succeed or fail together. Single statements
    go through ``fetch_all``/``fetch_one``/``execute``, which run in autocommit mode and
    so skip the separate BEGIN and COMMIT round trips.
    """
    with _connection(autocommit=False) as connection:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            yield cursor
        connection.commit()


@contextmanager
def _connection(*, autocommit: bool) -> Iterator[Any]:
    pool = _get_pool()
    connection = _checkout_live_connection(pool)
    connection.autocommit = autocommit
    discard = False

    try:
        yield connection
    except psycopg2.Error as exc:
        discard = connection.closed != 0
        if not discard and not autocommit:
            connection.rollback()
        raise DataServiceError(_format_pg_error(exc)) from exc
    except BaseException:
        discard = connection.closed != 0
        if not discard and not autocommit:
            connection.rollback()
        raise
    finally:
        if not discard and autocommit:
            connection.autocommit = False
        _return_connection(pool, connection, discard=discard)


def fetch_all(sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Run one statement in autocommit mode (a single network round trip)."""
    with _connection(autocommit=True) as connection:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(sql, params)
            return [_normalize_row(row) for row in cursor.fetchall()] if cursor.description else []


def fetch_one(sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> int:
    """Run one statement in autocommit mode and return the affected row count."""
    with _connection(autocommit=True) as connection:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(sql, params)
            return cursor.rowcount


def normalize_rows(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_normalize_row(row) for row in rows]


def json_param(value: Any) -> psycopg2.extras.Json:
    return psycopg2.extras.Json(value)


def _checkout_live_connection(pool: psycopg2.pool.ThreadedConnectionPool):
    try:
        connection = pool.getconn()
    except psycopg2.Error as exc:
        raise DataServiceError(f"Database connection failed: {_format_pg_error(exc)}") from exc

    returned_at = _last_returned_at.pop(id(connection), None)
    recently_used = returned_at is not None and time.monotonic() - returned_at < IDLE_PING_AFTER_SECONDS
    if connection.closed == 0 and (recently_used or _is_connection_alive(connection)):
        return connection

    logger.info("Discarding stale pooled database connection")
    pool.putconn(connection, close=True)

    try:
        return pool.getconn()
    except psycopg2.Error as exc:
        raise DataServiceError(f"Database connection failed: {_format_pg_error(exc)}") from exc


def _return_connection(pool: psycopg2.pool.ThreadedConnectionPool, connection, *, discard: bool) -> None:
    if not discard:
        _last_returned_at[id(connection)] = time.monotonic()
    pool.putconn(connection, close=discard)


def _is_connection_alive(connection) -> bool:
    if connection.closed != 0:
        return False

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        connection.rollback()
    except psycopg2.Error:
        return False

    return True


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Convert driver types to the JSON-shaped values the service layer expects."""
    return {key: _normalize_value(value) for key, value in row.items()}


def _normalize_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]

    return value


def _format_pg_error(exc: psycopg2.Error) -> str:
    message = (getattr(exc, "pgerror", None) or str(exc) or exc.__class__.__name__).strip()
    if message.startswith("ERROR:"):
        message = message.removeprefix("ERROR:").strip()

    return message.splitlines()[0] if message else "Database request failed."
