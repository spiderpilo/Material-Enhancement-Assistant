from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import (
    AUTH_ERRORS,
    FORBIDDEN_ERROR,
    PROJECT_ERRORS,
    UPSTREAM_ERRORS,
    ErrorResponse,
    require_access_token,
    unauthorized,
)

from app.models.chat_model import (
    ProjectChatHistoryResponse,
    ProjectChatRequest,
    ProjectChatResponse,
)
from app.models.generated_material_model import (
    GeneratedMaterialDownloadResponse,
    GeneratedMaterialRecord,
    ListGeneratedMaterialsResponse,
    SlideDeckGenerateRequest,
)
from app.models.quiz_model import ListGeneratedQuizHistoryResponse
from app.models.project_model import (
    CreateProjectRequest,
    ListProjectsResponse,
    ProjectRecord,
    ProjectSummary,
    UpdateProjectRequest,
)
from app.services.export_service import SlideDeckExportError
from app.services.embedding_service import GeminiEmbeddingError, MissingGeminiAPIKeyError
from app.services.llm_service import GeminiServiceError, MissingAPIKeyError
from app.services.data_service import (
    AuthenticationError,
    GeneratedMaterialNotFoundError,
    MissingConfigError,
    ProjectAccessDeniedError,
    ProjectNotFoundError,
    DataServiceError,
    answer_project_question_for_user,
    clear_project_chat_history_for_user,
    create_project_for_user,
    delete_project_for_user,
    generate_slide_deck_for_user,
    get_project_chat_history_for_user,
    get_project_for_user,
    get_generated_material_download_for_user,
    list_generated_quiz_history_for_user,
    list_generated_materials_for_user,
    list_projects_for_user,
    update_project_for_user,
)


router = APIRouter()


@router.get(
    "/projects",
    response_model=ListProjectsResponse,
    tags=["Projects"],
    summary="List projects",
    description='Projects owned by the signed-in user, newest first, with material counts. Use `limit` to cap the result.',
    responses={**AUTH_ERRORS, **UPSTREAM_ERRORS},
)
def list_projects(
    access_token: str = Depends(require_access_token),
    limit: int | None = Query(default=None, ge=1, le=100),
) -> ListProjectsResponse:
    try:
        return ListProjectsResponse(
            projects=list_projects_for_user(
                access_token=access_token,
                limit=limit,
            )
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/projects",
    response_model=ProjectSummary,
    status_code=status.HTTP_201_CREATED,
    tags=["Projects"],
    summary="Create a project",
    description='Creates an empty project owned by the signed-in user. Name defaults to "Untitled Project".',
    responses={**AUTH_ERRORS, **UPSTREAM_ERRORS},
)
def create_project(
    payload: CreateProjectRequest | None = None,
    access_token: str = Depends(require_access_token),
) -> ProjectSummary:
    try:
        project_name = (payload.name if payload else None) or "Untitled Project"
        return create_project_for_user(
            access_token=access_token,
            name=project_name.strip(),
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/projects/{project_uuid}",
    response_model=ProjectRecord,
    tags=["Projects"],
    summary="Get a project",
    description="Project details and its uploaded materials, including each material's preview and indexing status.",
    responses={**PROJECT_ERRORS, **UPSTREAM_ERRORS},
)
def get_project(
    project_uuid: str,
    access_token: str = Depends(require_access_token),
) -> ProjectRecord:
    try:
        return get_project_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/projects/{project_uuid}/chat",
    response_model=ProjectChatResponse,
    tags=["Project chat"],
    summary="Ask a question about project materials",
    description="Answers from the project's materials using retrieval, and stores the exchange in the project's chat memory.",
    responses={**PROJECT_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def chat_with_project(
    project_uuid: str,
    payload: ProjectChatRequest,
    access_token: str = Depends(require_access_token),
) -> ProjectChatResponse:
    normalized_message = payload.message.strip()
    if not normalized_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        return answer_project_question_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
            message=normalized_message,
            selected_material_id=payload.selected_material_id,
            selected_material_ids=payload.selected_material_ids,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except MissingGeminiAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (GeminiEmbeddingError, GeminiServiceError, DataServiceError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/projects/{project_uuid}/chat",
    response_model=ProjectChatHistoryResponse,
    tags=["Project chat"],
    summary="Get chat history",
    description='The stored conversation for this project.',
    responses={**PROJECT_ERRORS, **UPSTREAM_ERRORS},
)
def get_project_chat_history(
    project_uuid: str,
    access_token: str = Depends(require_access_token),
) -> ProjectChatHistoryResponse:
    try:
        return get_project_chat_history_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete(
    "/projects/{project_uuid}/chat",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Project chat"],
    summary="Clear chat history",
    description='Deletes the stored conversation for this project.',
    responses={**PROJECT_ERRORS, **UPSTREAM_ERRORS},
)
def clear_project_chat_history(
    project_uuid: str,
    access_token: str = Depends(require_access_token),
) -> Response:
    try:
        clear_project_chat_history_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch(
    "/projects/{project_uuid}",
    response_model=ProjectRecord,
    tags=["Projects"],
    summary="Rename a project",
    description='Changes the project name. Only the owner can rename it.',
    responses={**PROJECT_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def update_project(
    project_uuid: str,
    payload: UpdateProjectRequest,
    access_token: str = Depends(require_access_token),
) -> ProjectRecord:
    normalized_name = payload.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Project title cannot be empty.")

    try:
        return update_project_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
            name=normalized_name,
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
    "/projects/{project_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Projects"],
    summary="Delete a project",
    description='Deletes the project and its material links. Only the owner can delete it.',
    responses={**PROJECT_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def delete_project(
    project_uuid: str,
    access_token: str = Depends(require_access_token),
) -> Response:
    try:
        delete_project_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
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


@router.get(
    "/projects/{project_uuid}/generated-materials",
    response_model=ListGeneratedMaterialsResponse | ListGeneratedQuizHistoryResponse,
    tags=["Generated materials"],
    summary="List generated materials",
    description='Slide decks and other generated outputs for the project. With `tool=quiz`, returns saved quizzes instead.',
    responses={**PROJECT_ERRORS, **UPSTREAM_ERRORS},
)
def list_generated_materials(
    project_uuid: str,
    tool: Literal["quiz"] | None = Query(default=None),
    access_token: str = Depends(require_access_token),
) -> ListGeneratedMaterialsResponse | ListGeneratedQuizHistoryResponse:
    try:
        if tool == "quiz":
            return ListGeneratedQuizHistoryResponse(
                generated_quizzes=list_generated_quiz_history_for_user(
                    access_token=access_token,
                    project_uuid=project_uuid,
                )
            )
        return ListGeneratedMaterialsResponse(
            generated_materials=list_generated_materials_for_user(
                access_token=access_token,
                project_uuid=project_uuid,
            )
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/projects/{project_uuid}/slide-decks/generate",
    response_model=GeneratedMaterialRecord,
    status_code=status.HTTP_201_CREATED,
    tags=["Generated materials"],
    summary="Generate a slide deck",
    description='Builds a PPTX slide deck from selected project materials and stores it.',
    responses={**PROJECT_ERRORS, **UPSTREAM_ERRORS},
)
def generate_slide_deck(
    project_uuid: str,
    payload: SlideDeckGenerateRequest,
    access_token: str = Depends(require_access_token),
) -> GeneratedMaterialRecord:
    try:
        return generate_slide_deck_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
            material_ids=payload.material_ids,
            slide_count=payload.slide_count,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (GeminiServiceError, SlideDeckExportError, DataServiceError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/projects/{project_uuid}/generated-materials/{generated_material_uuid}/download",
    response_model=GeneratedMaterialDownloadResponse,
    tags=["Generated materials"],
    summary="Get a download link",
    description='Returns a download URL for a generated slide deck as PPTX or PDF.',
    responses={**PROJECT_ERRORS, 400: {"model": ErrorResponse, "description": "This material has no file in the requested format."}, **UPSTREAM_ERRORS},
)
def get_generated_material_download(
    project_uuid: str,
    generated_material_uuid: str,
    format: Literal["pptx", "pdf"] = Query(default="pptx"),
    access_token: str = Depends(require_access_token),
) -> GeneratedMaterialDownloadResponse:
    try:
        download_url, file_name = get_generated_material_download_for_user(
            access_token=access_token,
            project_uuid=project_uuid,
            generated_material_uuid=generated_material_uuid,
            download_format=format,
        )
        return GeneratedMaterialDownloadResponse(
            download_url=download_url,
            file_name=file_name,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeneratedMaterialNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DataServiceError as exc:
        normalized_message = str(exc).lower()
        if "downloadable file" in normalized_message or "pdf download is only available" in normalized_message:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc
