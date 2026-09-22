#!/usr/bin/env bash
# Throwaway Postgres + pgvector for backend integration tests.
#   backend/scripts/test_db.sh start   # prints the TEST_DATABASE_URL to export
#   backend/scripts/test_db.sh stop
set -euo pipefail

CONTAINER="mea-test-db"
PORT="${TEST_DB_PORT:-55432}"
URL="postgresql://postgres:test@localhost:${PORT}/mea_test"

case "${1:-start}" in
  start)
    if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
      docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
      docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=mea_test \
        -p "${PORT}:5432" pgvector/pgvector:pg17 >/dev/null
    fi
    until docker exec "$CONTAINER" pg_isready -U postgres -q; do sleep 1; done
    echo "export TEST_DATABASE_URL=${URL}"
    ;;
  stop)
    docker rm -f "$CONTAINER" >/dev/null
    ;;
  *)
    echo "usage: $0 start|stop" >&2
    exit 1
    ;;
esac
