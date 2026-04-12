import re
from pathlib import Path


SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(filename: str, *, fallback_name: str = "upload") -> str:
    normalized_name = Path(filename).name.strip()
    if not normalized_name:
        normalized_name = fallback_name

    path = Path(normalized_name)
    sanitized_stem = SAFE_FILENAME_PATTERN.sub("_", path.stem).strip("._-") or fallback_name
    sanitized_suffix = SAFE_FILENAME_PATTERN.sub("", path.suffix.lower())

    return f"{sanitized_stem}{sanitized_suffix}"
