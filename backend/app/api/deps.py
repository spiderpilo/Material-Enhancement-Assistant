"""Shared API dependencies: bearer authentication and documented error responses."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
    bearerFormat="JWT",
    description=(
        "Access token returned by `POST /login-account`, `POST /create-account`, or "
        "`POST /refresh-token`. Paste only the token; Swagger UI adds the `Bearer` prefix."
    ),
)


class ErrorResponse(BaseModel):
    detail: str


def unauthorized(detail: str = "Sign in required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_access_token(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> str:
    """Return the raw bearer token, or reject the request before the handler runs.

    Signature, expiry, and session checks happen when the service layer resolves the
    token, which maps failures back to 401 through ``unauthorized``.
    """
    if credentials is None or not credentials.credentials.strip():
        raise unauthorized()

    return credentials.credentials.strip()


def _error(description: str) -> dict[str, Any]:
    return {"model": ErrorResponse, "description": description}


AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: _error("Missing, malformed, expired, or revoked access token."),
}
PROJECT_ERRORS: dict[int | str, dict[str, Any]] = {
    **AUTH_ERRORS,
    404: _error("Project not found, or not owned by the signed-in user."),
}
MATERIAL_ERRORS: dict[int | str, dict[str, Any]] = {
    **AUTH_ERRORS,
    404: _error("Course material not found, or not in a project owned by the signed-in user."),
}
FORBIDDEN_ERROR: dict[int | str, dict[str, Any]] = {
    403: _error("Resource exists but belongs to another user."),
}
UPSTREAM_ERRORS: dict[int | str, dict[str, Any]] = {
    500: _error("Server is missing required configuration."),
    502: _error("Database, storage, or AI provider request failed."),
}
