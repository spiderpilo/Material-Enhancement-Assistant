"""
Copy preview state from storage into the course_contents columns added by
migration 20260922 (source_type, preview_status, preview_count, preview_error).

Before that migration the only record of a material's preview state was
``course-content-previews/<id>/status.json`` (and ``manifest.json`` once ready)
in object storage. Reads now use the columns, so existing rows need them filled.

For each material:
  * manifest.json present  -> ready, count = number of pages in the manifest
  * only status.json       -> the status it records
  * neither                -> failed, unless --regenerate-missing renders previews
                              from the original file (needs LibreOffice for DOCX/PPTX)

Usage:
  backend/.venv/bin/python backend/scripts/backfill_preview_state.py --dry-run
  backend/.venv/bin/python backend/scripts/backfill_preview_state.py [--regenerate-missing]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services import data_service, db  # noqa: E402  (loads repo-root .env)


MISSING_PREVIEW_ERROR = "Preview images were not found in storage. Re-upload the file to rebuild them."


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print the state that would be written")
    parser.add_argument(
        "--regenerate-missing",
        action="store_true",
        help="Render previews from the original file when no preview assets exist",
    )
    args = parser.parse_args()

    rows = db.fetch_all("SELECT id, material_name, access_url FROM public.course_contents ORDER BY id")
    failures = 0

    for row in rows:
        course_content_id = row["id"]
        material_name = row["material_name"]
        try:
            source_type = data_service._detect_source_type(material_name)
        except data_service.DataServiceError:
            source_type = None

        state = _state_from_storage(course_content_id)
        if state is None and args.regenerate_missing and not args.dry_run and source_type:
            state = _regenerate(course_content_id, material_name, row["access_url"])
        if state is None:
            state = ("failed", 0, MISSING_PREVIEW_ERROR)

        preview_status, preview_count, preview_error = state
        print(f"{course_content_id:>6} {preview_status:<8} {preview_count:>4}  {material_name}")
        if preview_status == "failed":
            failures += 1
        if args.dry_run:
            continue

        db.execute(
            """
            UPDATE public.course_contents
            SET source_type = %s, preview_status = %s, preview_count = %s, preview_error = %s
            WHERE id = %s
            """,
            (source_type, preview_status, preview_count, preview_error, course_content_id),
        )

    print(f"{len(rows)} materials, {failures} without previews{' (dry run)' if args.dry_run else ''}")
    return 0


def _state_from_storage(course_content_id: int) -> tuple[str, int, str | None] | None:
    manifest = data_service._download_preview_manifest(course_content_id=course_content_id)
    if manifest and manifest.items:
        return "ready", len(manifest.items), None

    status = data_service._download_preview_status(course_content_id=course_content_id)
    preview_status = status.get("preview_status")
    if preview_status in {"pending", "ready", "failed"}:
        # "pending" with no manifest means the render job died; nothing will finish it.
        if preview_status == "pending" or (preview_status == "ready" and not manifest):
            return None
        preview_count = status.get("preview_count")
        preview_error = status.get("preview_error")
        return (
            preview_status,
            preview_count if isinstance(preview_count, int) else 0,
            preview_error if isinstance(preview_error, str) else None,
        )

    return None


def _regenerate(course_content_id: int, material_name: str, access_url: str) -> tuple[str, int, str | None] | None:
    try:
        file_bytes = data_service._download_object_by_url(access_url)
    except data_service.DataServiceError as exc:
        print(f"{course_content_id:>6} cannot regenerate: {exc}", file=sys.stderr)
        return None

    # Writes the images, manifest, status.json, and the row's preview columns.
    data_service.generate_course_content_preview_assets(
        course_content_id=course_content_id,
        filename=material_name,
        access_url=access_url,
        file_bytes=file_bytes,
    )
    row = db.fetch_one(
        "SELECT preview_status, preview_count, preview_error FROM public.course_contents WHERE id = %s",
        (course_content_id,),
    )
    return (row["preview_status"], row["preview_count"], row["preview_error"]) if row else None


if __name__ == "__main__":
    raise SystemExit(main())
