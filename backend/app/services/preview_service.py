from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

import fitz

from app.models.document_model import SourceType


PREVIEW_SCALE = 1.5


class DocumentPreviewError(Exception):
    """Raised when the backend cannot render preview images for a source."""


@dataclass(slots=True)
class RenderedPreviewItem:
    index: int
    kind: str
    label: str
    title: str
    subtitle: str
    image_name: str
    image_bytes: bytes
    width: int
    height: int


def render_course_content_previews(
    *,
    filename: str,
    file_bytes: bytes,
) -> tuple[SourceType, list[RenderedPreviewItem]]:
    source_type = _detect_source_type(filename)
    pdf_bytes = file_bytes if source_type == "pdf" else _convert_office_document_to_pdf(
        filename=filename,
        file_bytes=file_bytes,
        source_type=source_type,
    )

    return source_type, _render_pdf_preview_items(pdf_bytes=pdf_bytes, source_type=source_type)


def _detect_source_type(filename: str) -> SourceType:
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"

    raise DocumentPreviewError("Unsupported file type for source preview rendering.")


def _convert_office_document_to_pdf(
    *,
    filename: str,
    file_bytes: bytes,
    source_type: SourceType,
) -> bytes:
    soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice_bin:
        raise DocumentPreviewError(
            "DOCX and PPTX preview rendering requires LibreOffice. Use Docker or install `soffice`."
        )

    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / filename
        input_path.write_bytes(file_bytes)

        command = [
            soffice_bin,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_path),
            str(input_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            stderr = result.stderr.strip() or result.stdout.strip() or "Unknown conversion error."
            raise DocumentPreviewError(
                f"Failed to convert {source_type.upper()} source into PDF for preview rendering: {stderr}"
            )

        pdf_path = temp_path / f"{input_path.stem}.pdf"
        if not pdf_path.exists():
            raise DocumentPreviewError(
                f"Preview conversion completed without a PDF output for {source_type.upper()}."
            )

        return pdf_path.read_bytes()


def _render_pdf_preview_items(
    *,
    pdf_bytes: bytes,
    source_type: SourceType,
) -> list[RenderedPreviewItem]:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if document.page_count == 0:
            raise DocumentPreviewError("No previewable pages were found in the uploaded source.")

        item_kind = "slide" if source_type == "pptx" else "page"
        label_prefix = "Slide" if item_kind == "slide" else "Page"
        rendered_items: list[RenderedPreviewItem] = []

        for index, page in enumerate(document):
            pixmap = page.get_pixmap(matrix=fitz.Matrix(PREVIEW_SCALE, PREVIEW_SCALE), alpha=False)
            image_bytes = pixmap.tobytes("png")
            item_number = index + 1
            rendered_items.append(
                RenderedPreviewItem(
                    index=index,
                    kind=item_kind,
                    label=f"{label_prefix} {item_number}",
                    title=f"{label_prefix} {item_number}",
                    subtitle="Rendered source preview",
                    image_name=f"item-{item_number:03d}.png",
                    image_bytes=image_bytes,
                    width=pixmap.width,
                    height=pixmap.height,
                )
            )

        return rendered_items
    finally:
        document.close()
