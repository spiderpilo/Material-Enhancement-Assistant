from fastapi import APIRouter, HTTPException, status

from app.models.account_model import (
    CreateAccountRequest,
    CreateAccountResponse,
    LoginAccountRequest,
    LoginAccountResponse,
    RefreshSessionRequest,
)
from app.services.data_service import (
    AuthenticationError,
    InvalidCredentialsError,
    MissingConfigError,
    DataServiceError,
    create_account,
    login_account,
    refresh_session,
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
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/login-account", response_model=LoginAccountResponse, status_code=status.HTTP_200_OK)
def login_account_route(payload: LoginAccountRequest) -> LoginAccountResponse:
    try:
        return login_account(
            email=payload.email,
            password=payload.password,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/refresh-token", response_model=LoginAccountResponse, status_code=status.HTTP_200_OK)
def refresh_token_route(payload: RefreshSessionRequest) -> LoginAccountResponse:
    try:
        return refresh_session(refresh_token=payload.refresh_token)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
