#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_PYTHON="$REPO_ROOT/backend/.venv/bin/python"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing backend virtual environment python: $VENV_PYTHON"
  echo "Create it first:"
  echo "  python3 -m venv backend/.venv"
  echo "  backend/.venv/bin/python -m pip install -r backend/requirements.txt"
  exit 1
fi

cd "$REPO_ROOT"
exec "$VENV_PYTHON" -m uvicorn app.main:app --reload --app-dir backend --reload-dir backend/app
