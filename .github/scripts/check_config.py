"""Fail CI when environment configuration drifts between code, .env.example, compose, and Render.

Checks:
  - every env var the app reads is documented in .env.example
  - every var in .env.example is still read somewhere (no dead config)
  - render.yaml gives the backend every variable it requires at runtime
  - compose and render.yaml only pass documented variables
  - no Supabase variables remain in runtime code or deploy config
  - .env.example holds no secret values

Run from the repository root: python .github/scripts/check_config.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Set by the platform or the image build, not by operators.
PLATFORM_VARS = {"APP_VERSION", "PORT", "NODE_ENV", "HOSTNAME", "NEXT_TELEMETRY_DISABLED", "WATCHPACK_POLLING",
                 "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED"}

PY_ENV_READ = re.compile(r"""(?:getenv|_get_required_env|_get_positive_int_env|_require_env)\(\s*["']([A-Z][A-Z0-9_]+)["']""")
PY_REQUIRED_READ = re.compile(r"""_get_required_env\(\s*["']([A-Z][A-Z0-9_]+)["']""")
# Alias tuples such as GEMINI_ENV_VARS = ("GOOGLE_GEMINI_API_KEY", ...) read in a loop.
PY_ENV_TUPLE = re.compile(r"_ENV_VARS\s*=\s*\(([^)]*)\)")
TS_ENV_READ = re.compile(r"process\.env\.([A-Z][A-Z0-9_]+)")
SUPABASE_VAR = re.compile(r"\bSUPABASE_[A-Z_]+")
SECRET_NAME = re.compile(r"(SECRET|PASSWORD|_KEY$|_KEY_ID$)")

errors: list[str] = []


def error(path: str, message: str) -> None:
    errors.append(f"::error file={path}::{message}")


def read(rel: str) -> str:
    return (ROOT / rel).read_text()


def files(pattern: str) -> list[Path]:
    return [
        path for path in ROOT.glob(pattern)
        if not any(part in {".venv", "node_modules", ".next", "tests"} for part in path.parts)
    ]


def python_env_reads(paths: list[Path]) -> set[str]:
    found = set()
    for path in paths:
        text = path.read_text()
        found.update(PY_ENV_READ.findall(text))
        for group in PY_ENV_TUPLE.findall(text):
            found.update(re.findall(r"[\"']([A-Z][A-Z0-9_]+)[\"']", group))
    return found


def env_example() -> dict[str, str]:
    values = {}
    for line in read(".env.example").splitlines():
        match = re.match(r"^([A-Z][A-Z0-9_]*)=(.*)$", line.strip())
        if match:
            values[match.group(1)] = match.group(2)
    return values


def render_services() -> dict[str, set[str]]:
    services: dict[str, set[str]] = {}
    current = None
    for line in read("render.yaml").splitlines():
        if match := re.match(r"^    name:\s*(\S+)", line):
            current = match.group(1)
            services[current] = set()
        elif current and (match := re.match(r"^\s+- key:\s*([A-Z][A-Z0-9_]*)", line)):
            services[current].add(match.group(1))
    return services


def compose_vars() -> set[str]:
    return set(re.findall(r"^\s+([A-Z][A-Z0-9_]*):", read("compose.yaml"), flags=re.M))


def main() -> int:
    example = env_example()

    runtime_py = files("backend/app/**/*.py")
    tooling_py = files("backend/database/*.py")
    frontend_ts = files("frontend/src/**/*.ts") + files("frontend/src/**/*.tsx")

    runtime_reads = python_env_reads(runtime_py)
    required_backend = {v for p in runtime_py for v in PY_REQUIRED_READ.findall(p.read_text())}
    tooling_reads = python_env_reads(tooling_py)
    frontend_reads = {v for p in frontend_ts for v in TS_ENV_READ.findall(p.read_text())}
    app_reads = (runtime_reads | tooling_reads | frontend_reads) - PLATFORM_VARS

    for var in sorted(app_reads - example.keys()):
        error(".env.example", f"{var} is read by the application but not documented in .env.example")

    for var in sorted(example.keys() - app_reads):
        error(".env.example", f"{var} is documented but nothing reads it; remove it")

    for var, value in example.items():
        if SECRET_NAME.search(var) and value.strip():
            error(".env.example", f"{var} must be empty in .env.example (secrets never go in committed files)")

    services = render_services()
    backend_env = services.get("mea-backend")
    if backend_env is None or "mea-frontend" not in services:
        error("render.yaml", "expected services mea-backend and mea-frontend")
    else:
        for var in sorted((required_backend | {"CORS_ALLOWED_ORIGINS"}) - backend_env):
            error("render.yaml", f"mea-backend is missing required env var {var}")
        for name, keys in services.items():
            for var in sorted(keys - example.keys()):
                error("render.yaml", f"{name} sets {var}, which is not documented in .env.example")

    for var in sorted(compose_vars() - example.keys() - PLATFORM_VARS):
        error("compose.yaml", f"compose passes {var}, which is not documented in .env.example")

    deploy_config = [".env.example", "compose.yaml", "render.yaml"]
    runtime_sources = [str(p.relative_to(ROOT)) for p in runtime_py + frontend_ts]
    for rel in deploy_config + runtime_sources:
        for var in sorted(set(SUPABASE_VAR.findall(read(rel)))):
            error(rel, f"Supabase variable {var} remains; runtime and deploy config must not depend on Supabase")

    if errors:
        print("\n".join(errors))
        print(f"\nConfiguration check failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(f"Configuration OK: {len(example)} documented vars, {len(required_backend)} required by the backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
