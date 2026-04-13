from fastapi import APIRouter, HTTPException, status

from app.models.account_model import (
    CreateAccountRequest,
    CreateAccountResponse,
    LoginAccountRequest,
    LoginAccountResponse,
)
from app.services.supabase_service import (
    InvalidCredentialsError,
    MissingSupabaseConfigError,
    SupabaseServiceError,
    create_account,
    login_account,
)


router = APIRouter()


@router.post("/create-account", response_model=CreateAccountResponse, status_code=status.HTTP_201_CREATED)
def create_account_route(payload: CreateAccountRequest) -> CreateAccountResponse:
    try:
        return create_account(
            email=payload.email,
            password=payload.password,
            username=payload.username,
            profession=payload.profession,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/login-account", response_model=LoginAccountResponse, status_code=status.HTTP_200_OK)
def login_account_route(payload: LoginAccountRequest) -> LoginAccountResponse:
    try:
        return login_account(
            email=payload.email,
            password=payload.password,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc