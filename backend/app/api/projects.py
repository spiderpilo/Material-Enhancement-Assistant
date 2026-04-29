from fastapi import APIRouter, Header, HTTPException, Query, status

from app.models.project_model import CreateProjectRequest, ProjectRecord, UpdateProjectRequest
from app.services.supabase_service import (
    AuthenticationError,
    MissingSupabaseConfigError,
    ProjectNotFoundError,
    SupabaseServiceError,
    create_project_for_user,
    get_project_for_user,
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


@router.get("/projects", response_model=list[ProjectRecord])
def list_projects(
    authorization: str | None = Header(default=None),
    limit: int | None = Query(default=None, ge=1, le=100),
) -> list[ProjectRecord]:
    try:
        return list_projects_for_user(
            access_token=_extract_bearer_token(authorization),
            limit=limit,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/projects", response_model=ProjectRecord, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    authorization: str | None = Header(default=None),
) -> ProjectRecord:
    try:
        return create_project_for_user(
            access_token=_extract_bearer_token(authorization),
            name=payload.name.strip(),
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/projects/{project_id}", response_model=ProjectRecord)
def get_project(
    project_id: int,
    authorization: str | None = Header(default=None),
) -> ProjectRecord:
    try:
        return get_project_for_user(
            access_token=_extract_bearer_token(authorization),
            project_id=project_id,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch("/projects/{project_id}", response_model=ProjectRecord)
def update_project(
    project_id: int,
    payload: UpdateProjectRequest,
    authorization: str | None = Header(default=None),
) -> ProjectRecord:
    try:
        return update_project_for_user(
            access_token=_extract_bearer_token(authorization),
            project_id=project_id,
            name=payload.name.strip(),
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
