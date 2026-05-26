from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Query, Response, status

from app.models.generated_material_model import (
    GeneratedMaterialDownloadResponse,
    GeneratedMaterialRecord,
    ListGeneratedMaterialsResponse,
    SlideDeckGenerateRequest,
)
from app.models.project_model import (
    CreateProjectRequest,
    ListProjectsResponse,
    ProjectRecord,
    ProjectSummary,
    UpdateProjectRequest,
)
from app.services.export_service import SlideDeckExportError
from app.services.llm_service import GeminiServiceError, MissingAPIKeyError
from app.services.supabase_service import (
    AuthenticationError,
    GeneratedMaterialNotFoundError,
    MissingSupabaseConfigError,
    ProjectAccessDeniedError,
    ProjectNotFoundError,
    SupabaseServiceError,
    create_project_for_user,
    delete_project_for_user,
    generate_slide_deck_for_user,
    get_project_for_user,
    get_generated_material_download_for_user,
    list_generated_materials_for_user,
    list_projects_for_user,
    update_project_for_user,
)


router = APIRouter()


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")

    return token


@router.get("/projects", response_model=ListProjectsResponse)
def list_projects(
    authorization: str | None = Header(default=None),
    limit: int | None = Query(default=None, ge=1, le=100),
) -> ListProjectsResponse:
    try:
        return ListProjectsResponse(
            projects=list_projects_for_user(
                access_token=_extract_bearer_token(authorization),
                limit=limit,
            )
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/projects", response_model=ProjectSummary, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest | None = None,
    authorization: str | None = Header(default=None),
) -> ProjectSummary:
    try:
        project_name = (payload.name if payload else None) or "Untitled Project"
        return create_project_for_user(
            access_token=_extract_bearer_token(authorization),
            name=project_name.strip(),
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/projects/{project_uuid}", response_model=ProjectRecord)
def get_project(
    project_uuid: str,
    authorization: str | None = Header(default=None),
) -> ProjectRecord:
    try:
        return get_project_for_user(
            access_token=_extract_bearer_token(authorization),
            project_uuid=project_uuid,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch("/projects/{project_uuid}", response_model=ProjectRecord)
def update_project(
    project_uuid: str,
    payload: UpdateProjectRequest,
    authorization: str | None = Header(default=None),
) -> ProjectRecord:
    normalized_name = payload.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Project title cannot be empty.")

    try:
        return update_project_for_user(
            access_token=_extract_bearer_token(authorization),
            project_uuid=project_uuid,
            name=normalized_name,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete("/projects/{project_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_uuid: str,
    authorization: str | None = Header(default=None),
) -> Response:
    try:
        delete_project_for_user(
            access_token=_extract_bearer_token(authorization),
            project_uuid=project_uuid,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/projects/{project_uuid}/generated-materials",
    response_model=ListGeneratedMaterialsResponse,
)
def list_generated_materials(
    project_uuid: str,
    authorization: str | None = Header(default=None),
) -> ListGeneratedMaterialsResponse:
    try:
        return ListGeneratedMaterialsResponse(
            generated_materials=list_generated_materials_for_user(
                access_token=_extract_bearer_token(authorization),
                project_uuid=project_uuid,
            )
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/projects/{project_uuid}/slide-decks/generate",
    response_model=GeneratedMaterialRecord,
    status_code=status.HTTP_201_CREATED,
)
def generate_slide_deck(
    project_uuid: str,
    payload: SlideDeckGenerateRequest,
    authorization: str | None = Header(default=None),
) -> GeneratedMaterialRecord:
    try:
        return generate_slide_deck_for_user(
            access_token=_extract_bearer_token(authorization),
            project_uuid=project_uuid,
            material_ids=payload.material_ids,
            slide_count=payload.slide_count,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (GeminiServiceError, SlideDeckExportError, SupabaseServiceError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/projects/{project_uuid}/generated-materials/{generated_material_uuid}/download",
    response_model=GeneratedMaterialDownloadResponse,
)
def get_generated_material_download(
    project_uuid: str,
    generated_material_uuid: str,
    format: Literal["pptx", "pdf"] = Query(default="pptx"),
    authorization: str | None = Header(default=None),
) -> GeneratedMaterialDownloadResponse:
    try:
        download_url, file_name = get_generated_material_download_for_user(
            access_token=_extract_bearer_token(authorization),
            project_uuid=project_uuid,
            generated_material_uuid=generated_material_uuid,
            download_format=format,
        )
        return GeneratedMaterialDownloadResponse(
            download_url=download_url,
            file_name=file_name,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeneratedMaterialNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        normalized_message = str(exc).lower()
        if "downloadable file" in normalized_message or "pdf download is only available" in normalized_message:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc
