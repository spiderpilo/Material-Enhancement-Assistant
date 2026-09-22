from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import AUTH_ERRORS, UPSTREAM_ERRORS, ErrorResponse, require_access_token, unauthorized
from app.models.account_model import (
    CreateAccountRequest,
    CreateAccountResponse,
    CurrentUserResponse,
    LoginAccountRequest,
    LoginAccountResponse,
    RefreshSessionRequest,
)
from app.services.data_service import (
    AccountConflictError,
    AuthenticationError,
    InvalidCredentialsError,
    MissingConfigError,
    DataServiceError,
    create_account,
    get_current_user,
    login_account,
    logout_session,
    refresh_session,
)


router = APIRouter(tags=["Authentication"])


@router.post(
    "/create-account",
    response_model=CreateAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
    description=(
        "Registers a user and signs them in. The response carries an access token and a "
        "refresh token, so no separate login call is needed."
    ),
    responses={
        409: {"model": ErrorResponse, "description": "Email address or username already registered."},
        **UPSTREAM_ERRORS,
    },
)
def create_account_route(payload: CreateAccountRequest, request: Request) -> CreateAccountResponse:
    try:
        return create_account(
            email=payload.email,
            password=payload.password,
            username=payload.username,
            profession=payload.profession,
            user_agent=request.headers.get("user-agent"),
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AccountConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/login-account",
    response_model=LoginAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in",
    description=(
        "Checks email and password and starts a new session. Each login is an independent "
        "session, so signing in from another browser does not sign out the first one."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Incorrect email or password."},
        **UPSTREAM_ERRORS,
    },
)
def login_account_route(payload: LoginAccountRequest, request: Request) -> LoginAccountResponse:
    try:
        return login_account(
            email=payload.email,
            password=payload.password,
            user_agent=request.headers.get("user-agent"),
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/refresh-token",
    response_model=LoginAccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh tokens",
    description=(
        "Exchanges a refresh token for a new access token and a new refresh token. The "
        "presented refresh token stops working immediately. Presenting an already-used "
        "refresh token revokes the whole session."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Refresh token is invalid, expired, reused, or revoked."},
        **UPSTREAM_ERRORS,
    },
)
def refresh_token_route(payload: RefreshSessionRequest) -> LoginAccountResponse:
    try:
        return refresh_session(refresh_token=payload.refresh_token)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out",
    description=(
        "Revokes the session behind the access token. Its access token and refresh token "
        "stop working at once; other sessions of the same user are unaffected."
    ),
    responses={**AUTH_ERRORS, **UPSTREAM_ERRORS},
)
def logout_route(access_token: str = Depends(require_access_token)) -> Response:
    try:
        logout_session(access_token=access_token)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    summary="Get the signed-in user",
    description="Returns the user that owns the access token. Useful to check whether a token is still valid.",
    responses={**AUTH_ERRORS, **UPSTREAM_ERRORS},
)
def current_user_route(access_token: str = Depends(require_access_token)) -> CurrentUserResponse:
    try:
        return get_current_user(access_token=access_token)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
