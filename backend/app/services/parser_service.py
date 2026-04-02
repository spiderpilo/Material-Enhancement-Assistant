import re
from io import BytesIO

import fitz
from docx import Document


PREVIEW_LENGTH = 300


class DocumentParseError(Exception):
    """Raised when an uploaded document cannot be parsed into text."""


def parse_document(*, file_bytes: bytes, file_type: str) -> str:
    try:
        if file_type == "pdf":
            raw_text = _extract_pdf_text(file_bytes)
        elif file_type == "docx":
            raw_text = _extract_docx_text(file_bytes)
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
        return "\n".join(page.get_text() for page in document)
    finally:
        document.close()


def _extract_docx_text(file_bytes: bytes) -> str:
    document = Document(BytesIO(file_bytes))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    return "\n".join(paragraphs)
