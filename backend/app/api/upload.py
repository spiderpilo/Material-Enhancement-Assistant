from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, status

from app.models.document_model import CourseContentPreviewManifest, CourseContentRecord
from app.services.supabase_service import (
    MissingSupabaseConfigError,
    PreviewNotFoundError,
    SupabaseServiceError,
    generate_course_content_preview_assets,
    get_course_content_preview,
    upload_course_content,
)


router = APIRouter()
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.post("/upload-doc", response_model=CourseContentRecord, status_code=status.HTTP_201_CREATED)
async def upload_doc(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> CourseContentRecord:
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

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Uploaded file is too large. Max file size is 50MB.",
        )

    try:
        record = upload_course_content(filename=filename, file_bytes=file_bytes)
        background_tasks.add_task(
            generate_course_content_preview_assets,
            course_content_id=record.id,
            filename=filename,
            access_url=record.access_url,
            file_bytes=file_bytes,
        )
        return record
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/course-contents/{course_content_id}/preview",
    response_model=CourseContentPreviewManifest,
)
async def get_course_content_preview_manifest(
    course_content_id: int,
) -> CourseContentPreviewManifest:
    try:
        return get_course_content_preview(course_content_id=course_content_id)
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except PreviewNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
