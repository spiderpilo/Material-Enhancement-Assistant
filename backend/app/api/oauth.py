"""Google and GitHub sign-in.

The browser leaves the frontend for ``/oauth/{provider}/authorize``, signs in with the
provider, and comes back to ``/oauth/{provider}/callback`` on this API. The callback
then redirects to the frontend's ``/auth/callback`` with one of these in the URL
fragment (never sent to a server, never in a Referer):

* ``code``   - returning user: POST it to ``/oauth/exchange`` for tokens;
* ``signup`` - new user: POST it with a username and role to ``/oauth/complete-signup``;
* ``error``  - a message to show.
"""

from __future__ import annotations

import hmac
import logging
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.api.deps import UPSTREAM_ERRORS, ErrorResponse, unauthorized
from app.config import get_frontend_url, get_oauth_redirect_base_url
from app.models.account_model import (
    CreateAccountResponse,
    LoginAccountResponse,
    OAuthExchangeRequest,
    OAuthSignupRequest,
)
from app.services import auth_service, oauth_service
from app.services.data_service import (
    AccountConflictError,
    AuthenticationError,
    DataServiceError,
    MissingConfigError,
    complete_oauth_signup,
    exchange_login_code,
    sign_in_with_oauth,
)
from app.services.oauth_service import OAuthError


router = APIRouter(prefix="/oauth", tags=["Authentication"])
logger = logging.getLogger(__name__)

STATE_COOKIE = "mea_oauth_state"
STATE_TTL_SECONDS = 600
ProviderName = Literal["google", "github"]


@router.get(
    "/{provider}/authorize",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    response_class=RedirectResponse,
    summary="Start Google or GitHub sign-in",
    description="Browser navigation only: redirects to the provider's consent screen.",
)
def oauth_authorize_route(provider: ProviderName, request: Request) -> RedirectResponse:
    state = oauth_service.new_state()
    code_verifier = oauth_service.new_code_verifier()
    redirect_uri = _callback_url(request, provider)
    try:
        authorization_url = oauth_service.build_authorization_url(
            provider, redirect_uri=redirect_uri, state=state, code_verifier=code_verifier
        )
        state_cookie = auth_service.encode_signed(
            "oauth_state",
            {"provider": provider, "state": state, "code_verifier": code_verifier},
            ttl_seconds=STATE_TTL_SECONDS,
        )
    except MissingConfigError as exc:
        logger.warning("OAuth sign-in unavailable: %s", exc)
        return _frontend_redirect(error=f"{provider.title()} sign-in is not available right now.")

    response = RedirectResponse(authorization_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(
        STATE_COOKIE,
        state_cookie,
        max_age=STATE_TTL_SECONDS,
        path="/oauth",
        httponly=True,
        secure=redirect_uri.startswith("https://"),
        # Lax still sends the cookie on the provider's top-level redirect back here.
        samesite="lax",
    )
    return response


@router.get(
    "/{provider}/callback",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    response_class=RedirectResponse,
    summary="Finish Google or GitHub sign-in",
    description="Called by the provider. Redirects to the frontend's /auth/callback page.",
)
def oauth_callback_route(
    provider: ProviderName,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        message = "Sign-in was cancelled." if error == "access_denied" else f"{provider.title()} sign-in failed."
        return _clear_state(_frontend_redirect(error=message))

    try:
        saved = auth_service.decode_signed(request.cookies.get(STATE_COOKIE), "oauth_state")
        # The state ties this callback to the browser that started the sign-in (CSRF).
        if saved.get("provider") != provider or not state or not hmac.compare_digest(str(saved.get("state")), state):
            raise AuthenticationError("OAuth state mismatch.")
        if not code:
            raise OAuthError("The provider did not return an authorization code.")

        profile = oauth_service.fetch_profile(
            provider,
            code=code,
            redirect_uri=_callback_url(request, provider),
            code_verifier=str(saved["code_verifier"]),
        )
        result = sign_in_with_oauth(profile=profile, user_agent=request.headers.get("user-agent"))
    except AuthenticationError as exc:
        logger.warning("OAuth callback rejected: %s", exc)
        return _clear_state(_frontend_redirect(error="Your sign-in session expired. Please try again."))
    except OAuthError as exc:
        logger.warning("OAuth sign-in failed: %s", exc)
        return _clear_state(_frontend_redirect(error=str(exc)))
    except (MissingConfigError, DataServiceError) as exc:
        logger.warning("OAuth sign-in failed: %s", exc)
        return _clear_state(_frontend_redirect(error="Sign-in failed. Please try again."))

    if result.login_code:
        return _clear_state(_frontend_redirect(code=result.login_code))
    return _clear_state(
        _frontend_redirect(signup=result.signup_ticket, email=profile.email or "", name=profile.name or "")
    )


@router.post(
    "/exchange",
    response_model=LoginAccountResponse,
    summary="Exchange an OAuth login code",
    description=(
        "Trades the one-time code from the OAuth redirect for an access token and refresh "
        "token. A code works once and expires after two minutes."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Code is invalid, expired, or already used."},
        **UPSTREAM_ERRORS,
    },
)
def oauth_exchange_route(payload: OAuthExchangeRequest) -> LoginAccountResponse:
    try:
        return exchange_login_code(code=payload.code)
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized("This sign-in link expired. Please sign in again.") from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/complete-signup",
    response_model=CreateAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account from Google or GitHub",
    description=(
        "Creates the account for a first-time Google or GitHub sign-in, using the ticket "
        "from the OAuth redirect plus the chosen username and role, and signs it in."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Ticket is invalid or expired."},
        409: {"model": ErrorResponse, "description": "Username taken, or the email or provider account is already registered."},
        **UPSTREAM_ERRORS,
    },
)
def oauth_complete_signup_route(payload: OAuthSignupRequest, request: Request) -> CreateAccountResponse:
    try:
        return complete_oauth_signup(
            ticket=payload.ticket,
            username=payload.username.strip(),
            profession=payload.profession,
            user_agent=request.headers.get("user-agent"),
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized("This sign-up link expired. Please sign in again.") from exc
    except AccountConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DataServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _callback_url(request: Request, provider: str) -> str:
    base_url = get_oauth_redirect_base_url() or str(request.base_url).rstrip("/")
    return f"{base_url}/oauth/{provider}/callback"


def _frontend_redirect(**fragment: str | None) -> RedirectResponse:
    values = {key: value for key, value in fragment.items() if value is not None}
    return RedirectResponse(
        f"{get_frontend_url()}/auth/callback#{urlencode(values)}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


def _clear_state(response: RedirectResponse) -> RedirectResponse:
    response.delete_cookie(STATE_COOKIE, path="/oauth")
    return response
