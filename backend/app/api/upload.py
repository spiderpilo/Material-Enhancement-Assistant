from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.models.document_model import CourseContentRecord
from app.services.supabase_service import (
    MissingSupabaseConfigError,
    SupabaseServiceError,
    upload_course_content,
)


router = APIRouter()
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx"}


@router.post("/upload-doc", response_model=CourseContentRecord, status_code=status.HTTP_201_CREATED)
async def upload_doc(file: UploadFile = File(...)) -> CourseContentRecord:
    filename = Path(file.filename or "upload").name
    suffix = Path(filename).suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOCX, and PPTX files are supported.",
        )

    try:
        file_bytes = await file.read()
    finally:
        await file.close()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        return upload_course_content(filename=filename, file_bytes=file_bytes)
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
