from __future__ import annotations

from pathlib import Path

from starlette.concurrency import run_in_threadpool

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status

from app.api.deps import (
    FORBIDDEN_ERROR,
    MATERIAL_ERRORS,
    PROJECT_ERRORS,
    UPSTREAM_ERRORS,
    ErrorResponse,
    require_access_token,
    unauthorized,
)

from app.models.document_model import (
    CourseContentFileResponse,
    CourseContentPreviewManifest,
    CourseContentRecord,
    UpdateCourseContentRequest,
)
from app.services.data_service import (
    AuthenticationError,
    DuplicateCourseContentError,
    InvalidStorageLocationError,
    StoredFileMissingError,
    MissingConfigError,
    PreviewNotFoundError,
    ProjectAccessDeniedError,
    ProjectNotFoundError,
    DataServiceError,
    delete_course_content_for_user,
    generate_course_content_rag_index,
    generate_course_content_preview_assets,
    get_course_content_file_for_user,
    get_course_content_preview_for_user,
    update_course_content_name_for_user,
    upload_course_content,
)


router = APIRouter()
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.post(
    "/upload-doc",
    response_model=CourseContentRecord,
    status_code=status.HTTP_201_CREATED,
    tags=["Course materials"],
    summary="Upload a course material",
    description='Uploads a PDF, DOCX, or PPTX (max 50MB) into a project. Page previews and the search index are built in the background; poll the preview endpoint for progress.',
    responses={**PROJECT_ERRORS, 400: {"model": ErrorResponse, "description": "Unsupported or empty file."}, 409: {"model": ErrorResponse, "description": "The same file is already in this project."}, 413: {"model": ErrorResponse, "description": "File is larger than 50MB."}, **UPSTREAM_ERRORS},
)
async def upload_doc(
    background_tasks: BackgroundTasks,
    project_id: int = Form(...),
    file: UploadFile = File(...),
    access_token: str = Depends(require_access_token),
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
        # Storage and database calls block; keep them off the event loop.
        record = await run_in_threadpool(
            upload_course_content,
            filename=filename,
            file_bytes=file_bytes,
            project_id=project_id,
            access_token=access_token,
        )
        background_tasks.add_task(
            generate_course_content_preview_assets,
            course_content_id=record.id,
            filename=filename,
            access_url=record.access_url,
            file_bytes=file_bytes,
        )
        background_tasks.add_task(
            generate_course_content_rag_index,
            course_content_id=record.id,
            project_id=project_id,
            filename=filename,
            file_bytes=file_bytes,
        )
        return record
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DuplicateCourseContentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/course-contents/{course_content_id}/preview",
    response_model=CourseContentPreviewManifest,
    tags=["Course materials"],
    summary="Get material preview",
    description='Preview status and page images for an uploaded material.',
    responses={**MATERIAL_ERRORS, **UPSTREAM_ERRORS},
)
def get_course_content_preview_manifest(
    course_content_id: int,
    access_token: str = Depends(require_access_token),
) -> CourseContentPreviewManifest:
    try:
        return get_course_content_preview_for_user(
            access_token=access_token,
            course_content_id=course_content_id,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except PreviewNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/course-contents/{course_content_id}/file",
    response_model=CourseContentFileResponse,
    tags=["Course materials"],
    summary="Get the original file",
    description='Checks that the uploaded file exists in storage and returns a URL the browser can display (PDFs render inline).',
    responses={**MATERIAL_ERRORS, 422: {"model": ErrorResponse, "description": "Stored file URL does not point into the configured storage bucket."}, **UPSTREAM_ERRORS},
)
def get_course_content_file(
    course_content_id: int,
    access_token: str = Depends(require_access_token),
) -> CourseContentFileResponse:
    try:
        return get_course_content_file_for_user(
            access_token=access_token,
            course_content_id=course_content_id,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except (ProjectNotFoundError, StoredFileMissingError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidStorageLocationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch(
    "/course-contents/{course_content_id}",
    response_model=CourseContentRecord,
    tags=["Course materials"],
    summary="Rename a material",
    description='Changes the display name of an uploaded material. The file extension is kept.',
    responses={**MATERIAL_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def rename_course_content(
    course_content_id: int,
    payload: UpdateCourseContentRequest,
    access_token: str = Depends(require_access_token),
) -> CourseContentRecord:
    try:
        return update_course_content_name_for_user(
            access_token=access_token,
            course_content_id=course_content_id,
            material_name=payload.material_name,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete(
    "/course-contents/{course_content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Course materials"],
    summary="Delete a material",
    description='Removes the material, its previews, and its search index.',
    responses={**MATERIAL_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def delete_course_content(
    course_content_id: int,
    access_token: str = Depends(require_access_token),
) -> Response:
    try:
        delete_course_content_for_user(
            access_token=access_token,
            course_content_id=course_content_id,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
