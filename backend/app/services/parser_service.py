import logging
import re
import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import Literal
from xml.etree import ElementTree

import fitz
from docx import Document


PREVIEW_LENGTH = 300
DOCX_SECTION_TARGET_CHARS = 3000
logger = logging.getLogger(__name__)
ParsedLocationKind = Literal["page", "slide", "section"]


class DocumentParseError(Exception):
    """Raised when an uploaded document cannot be parsed into text."""


@dataclass(frozen=True)
class ParsedTextUnit:
    index: int
    text: str
    location_kind: ParsedLocationKind
    location_start: int
    location_end: int


def parse_document(*, file_bytes: bytes, file_type: str) -> str:
    units = parse_document_units(file_bytes=file_bytes, file_type=file_type)
    return normalize_text("\n".join(unit.text for unit in units))


def parse_document_units(*, file_bytes: bytes, file_type: str) -> list[ParsedTextUnit]:
    try:
        if file_type == "pdf":
            raw_units = _extract_pdf_text_units(file_bytes)
        elif file_type == "docx":
            raw_units = _extract_docx_text_units(file_bytes)
        elif file_type == "pptx":
            raw_units = _extract_pptx_text_units(file_bytes)
        else:
            raise DocumentParseError("Unsupported file type.")
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError(f"Failed to parse the uploaded {file_type.upper()} file.") from exc

    cleaned_units: list[ParsedTextUnit] = []
    for unit in raw_units:
        cleaned_text = normalize_text(unit.text)
        if not cleaned_text:
            continue
        cleaned_units.append(
            ParsedTextUnit(
                index=len(cleaned_units),
                text=cleaned_text,
                location_kind=unit.location_kind,
                location_start=unit.location_start,
                location_end=unit.location_end,
            )
        )

    if not cleaned_units:
        raise DocumentParseError("No text could be extracted from the uploaded file.")

    return cleaned_units


def build_preview(text: str, length: int = PREVIEW_LENGTH) -> str:
    return text[:length]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_pdf_text(file_bytes: bytes) -> str:
    return "\n".join(unit.text for unit in _extract_pdf_text_units(file_bytes))


def _extract_pdf_text_units(file_bytes: bytes) -> list[ParsedTextUnit]:
    document = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        page_units: list[ParsedTextUnit] = []
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
                page_number = page_index + 1
                page_units.append(
                    ParsedTextUnit(
                        index=len(page_units),
                        text=page_text,
                        location_kind="page",
                        location_start=page_number,
                        location_end=page_number,
                    )
                )

        if failed_page_count:
            logger.warning(
                "Skipped %s unreadable PDF page(s) while extracting source text.",
                failed_page_count,
            )

        return page_units
    finally:
        document.close()


def _extract_docx_text(file_bytes: bytes) -> str:
    return "\n".join(unit.text for unit in _extract_docx_text_units(file_bytes))


def _extract_docx_text_units(file_bytes: bytes) -> list[ParsedTextUnit]:
    document = Document(BytesIO(file_bytes))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    section_units: list[ParsedTextUnit] = []
    current_paragraphs: list[str] = []
    current_length = 0

    for paragraph in paragraphs:
        next_length = current_length + len(paragraph) + (1 if current_paragraphs else 0)
        if current_paragraphs and next_length > DOCX_SECTION_TARGET_CHARS:
            section_number = len(section_units) + 1
            section_units.append(
                ParsedTextUnit(
                    index=len(section_units),
                    text="\n".join(current_paragraphs),
                    location_kind="section",
                    location_start=section_number,
                    location_end=section_number,
                )
            )
            current_paragraphs = []
            current_length = 0
            next_length = len(paragraph)

        current_length = next_length
        current_paragraphs.append(paragraph)

    if current_paragraphs:
        section_number = len(section_units) + 1
        section_units.append(
            ParsedTextUnit(
                index=len(section_units),
                text="\n".join(current_paragraphs),
                location_kind="section",
                location_start=section_number,
                location_end=section_number,
            )
        )

    return section_units


def _extract_pptx_text(file_bytes: bytes) -> str:
    return "\n".join(unit.text for unit in _extract_pptx_text_units(file_bytes))


def _extract_pptx_text_units(file_bytes: bytes) -> list[ParsedTextUnit]:
    slide_units: list[ParsedTextUnit] = []

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
                slide_number = _slide_sort_key(slide_name)
                slide_units.append(
                    ParsedTextUnit(
                        index=len(slide_units),
                        text=" ".join(text_nodes),
                        location_kind="slide",
                        location_start=slide_number,
                        location_end=slide_number,
                    )
                )

    return slide_units


def _slide_sort_key(slide_name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", slide_name)
    return int(match.group(1)) if match else 0
