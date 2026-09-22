"""
Copy every object from the Supabase Storage bucket into the S3-compatible bucket
used by the backend, keeping object keys unchanged.

The database backup only holds storage metadata; the file bytes (uploaded sources,
preview PNGs, preview manifest/status JSON, generated decks) live in Supabase and
must be copied before the Supabase project is shut down. Preview JSON files embed
full Supabase object URLs, so those URLs are rewritten to STORAGE_PUBLIC_URL while
copying.

The source is either the live Supabase bucket or a local download of it
(``--source-dir``, a folder whose relative paths are the object keys, e.g. a
Supabase dashboard bucket export). A local source is the only option once the
Supabase project has been deleted.

Reads from the repo-root .env (or the environment):
  source: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
          (not needed with --source-dir)
  target: S3_BUCKET, S3_ENDPOINT_URL, S3_REGION, S3_ACCESS_KEY_ID,
          S3_SECRET_ACCESS_KEY, STORAGE_PUBLIC_URL

Usage:
  python backend/scripts/migrate_supabase_storage.py --dry-run
  python backend/scripts/migrate_supabase_storage.py
  python backend/scripts/migrate_supabase_storage.py --source-dir ~/Downloads/<project-ref>/course-contents
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
from pathlib import Path
from urllib import error, parse, request

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.config import get_storage_settings  # noqa: E402  (loads repo-root .env)
from app.services import storage_service  # noqa: E402


LIST_PAGE_SIZE = 1000
REQUEST_TIMEOUT_SECONDS = 60
IGNORED_LOCAL_FILES = {".DS_Store", "Thumbs.db"}
SUPABASE_OBJECT_URL = re.compile(
    r"https://[a-z0-9-]+\.supabase\.co/storage/v1/object/(?:public/)?[^/\s\"\\]+/"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="List objects without copying")
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Copy from a local download of the bucket instead of the Supabase API",
    )
    args = parser.parse_args()

    target = get_storage_settings()

    if args.source_dir:
        source_dir = args.source_dir.expanduser().resolve()
        if not source_dir.is_dir():
            raise SystemExit(f"{source_dir} is not a directory.")
        objects = list(_list_local_objects(source_dir))
        source_label = f"local directory {source_dir}"

        def download(key: str) -> bytes:
            return (source_dir / key).read_bytes()
    else:
        supabase_url = _require_env("SUPABASE_URL").rstrip("/")
        service_role_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
        source_bucket = _require_env("SUPABASE_STORAGE_BUCKET")
        objects = list(_list_objects(supabase_url, service_role_key, source_bucket, prefix=""))
        source_label = f"Supabase bucket {source_bucket}"

        def download(key: str) -> bytes:
            return _download(supabase_url, service_role_key, source_bucket, key)

    total_bytes = sum(size for _, size, _ in objects)
    print(f"Found {len(objects)} objects ({total_bytes / 1_048_576:.1f} MiB) in {source_label}")

    if args.dry_run:
        for key, size, _ in objects:
            print(f"  {key} ({size} bytes)")
        return 0

    rewritten_json = 0
    failures: list[str] = []

    for index, (key, _, mimetype) in enumerate(objects, start=1):
        try:
            body = download(key)
            content_type = mimetype or mimetypes.guess_type(key)[0] or "application/octet-stream"

            if key.endswith(".json"):
                body, replaced = _rewrite_json_urls(body, target.public_url)
                rewritten_json += 1 if replaced else 0

            storage_service.put_object(key=key, body=body, content_type=content_type)
            print(f"[{index}/{len(objects)}] copied {key}")
        except Exception as exc:  # keep going; report every failure at the end
            failures.append(f"{key}: {exc}")
            print(f"[{index}/{len(objects)}] FAILED {key}: {exc}", file=sys.stderr)

    print(f"Copied {len(objects) - len(failures)}/{len(objects)} objects; rewrote URLs in {rewritten_json} JSON files")
    if failures:
        print("Failures:", *failures, sep="\n  ", file=sys.stderr)
        return 1
    return 0


def _list_local_objects(source_dir: Path):
    """Yield (key, size, mimetype) for every file under source_dir, skipping OS metadata files."""
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.name in IGNORED_LOCAL_FILES:
            continue
        yield path.relative_to(source_dir).as_posix(), path.stat().st_size, None


def _list_objects(supabase_url: str, service_role_key: str, bucket: str, *, prefix: str):
    """Yield (key, size, mimetype) for every file under prefix, walking folders."""
    offset = 0
    while True:
        payload = json.dumps(
            {
                "prefix": prefix,
                "limit": LIST_PAGE_SIZE,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            }
        ).encode("utf-8")
        entries = json.loads(
            _request(
                f"{supabase_url}/storage/v1/object/list/{parse.quote(bucket, safe='')}",
                service_role_key,
                method="POST",
                data=payload,
                content_type="application/json",
            )
        )

        for entry in entries:
            name = entry["name"]
            key = f"{prefix}/{name}" if prefix else name
            if entry.get("id") is None:
                yield from _list_objects(supabase_url, service_role_key, bucket, prefix=key)
                continue

            metadata = entry.get("metadata") or {}
            yield key, int(metadata.get("size") or 0), metadata.get("mimetype")

        if len(entries) < LIST_PAGE_SIZE:
            return
        offset += LIST_PAGE_SIZE


def _download(supabase_url: str, service_role_key: str, bucket: str, key: str) -> bytes:
    quoted_bucket = parse.quote(bucket, safe="")
    quoted_key = parse.quote(key, safe="/")
    return _request(f"{supabase_url}/storage/v1/object/{quoted_bucket}/{quoted_key}", service_role_key)


def _rewrite_json_urls(body: bytes, public_url: str) -> tuple[bytes, bool]:
    text = body.decode("utf-8")
    rewritten, replaced = SUPABASE_OBJECT_URL.subn(f"{public_url}/", text)
    return rewritten.encode("utf-8"), replaced > 0


def _request(
    url: str,
    service_role_key: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    content_type: str | None = None,
) -> bytes:
    headers = {"Authorization": f"Bearer {service_role_key}", "apikey": service_role_key}
    if content_type:
        headers["Content-Type"] = content_type

    try:
        with request.urlopen(
            request.Request(url, data=data, headers=headers, method=method),
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            return response.read()
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Supabase returned {exc.code} for {url}: {detail}") from exc


def _require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise SystemExit(f"{name} is not set.")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
