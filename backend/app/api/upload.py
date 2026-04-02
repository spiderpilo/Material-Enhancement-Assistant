from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.llm_service import (
    GeminiServiceError,
    MissingAPIKeyError,
    improve_clarity,
)
from app.services.parser_service import (
    DocumentParseError,
    build_preview,
    parse_document,
)


router = APIRouter()
SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/upload-doc")
async def upload_doc(file: UploadFile = File(...)) -> dict[str, str | int]:
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    try:
        file_bytes = await file.read()
    finally:
        await file.close()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_type = suffix.lstrip(".")

    try:
        extracted_text = parse_document(file_bytes=file_bytes, file_type=file_type)
        gemini_response = improve_clarity(extracted_text)
    except DocumentParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except GeminiServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "filename": filename,
        "file_type": file_type,
        "text_length": len(extracted_text),
        "preview": build_preview(extracted_text),
        "gemini_response": gemini_response,
    }
