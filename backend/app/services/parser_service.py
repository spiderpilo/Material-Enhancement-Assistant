import logging
import re
import zipfile
from io import BytesIO
from xml.etree import ElementTree

import fitz
from docx import Document


PREVIEW_LENGTH = 300
logger = logging.getLogger(__name__)


class DocumentParseError(Exception):
    """Raised when an uploaded document cannot be parsed into text."""


def parse_document(*, file_bytes: bytes, file_type: str) -> str:
    try:
        if file_type == "pdf":
            raw_text = _extract_pdf_text(file_bytes)
        elif file_type == "docx":
            raw_text = _extract_docx_text(file_bytes)
        elif file_type == "pptx":
            raw_text = _extract_pptx_text(file_bytes)
        else:
            raise DocumentParseError("Unsupported file type.")
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError(f"Failed to parse the uploaded {file_type.upper()} file.") from exc

    cleaned_text = normalize_text(raw_text)
    if not cleaned_text:
        raise DocumentParseError("No text could be extracted from the uploaded file.")

    return cleaned_text


def build_preview(text: str, length: int = PREVIEW_LENGTH) -> str:
    return text[:length]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_pdf_text(file_bytes: bytes) -> str:
    document = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        page_texts: list[str] = []
        failed_page_count = 0

        for page_index in range(document.page_count):
            try:
                page = document.load_page(page_index)
                page_text = page.get_text("text", sort=True).strip()
            except Exception as exc:
                failed_page_count += 1
                logger.warning(
                    "Skipping unreadable PDF page %s of %s during text extraction: %s",
                    page_index + 1,
                    document.page_count,
                    exc,
                )
                continue

            if page_text:
                page_texts.append(page_text)

        if failed_page_count:
            logger.warning(
                "Skipped %s unreadable PDF page(s) while extracting quiz source text.",
                failed_page_count,
            )

        return "\n".join(page_texts)
    finally:
        document.close()


def _extract_docx_text(file_bytes: bytes) -> str:
    document = Document(BytesIO(file_bytes))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    return "\n".join(paragraphs)


def _extract_pptx_text(file_bytes: bytes) -> str:
    slide_text: list[str] = []

    with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            ),
            key=_slide_sort_key,
        )

        for slide_name in slide_names:
            root = ElementTree.fromstring(archive.read(slide_name))
            text_nodes = [
                element.text.strip()
                for element in root.iter()
                if element.tag.endswith("}t") and element.text and element.text.strip()
            ]

            if text_nodes:
                slide_text.append(" ".join(text_nodes))

    return "\n".join(slide_text)


def _slide_sort_key(slide_name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", slide_name)
    return int(match.group(1)) if match else 0
