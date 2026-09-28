"""Google and GitHub OAuth 2.0 authorization-code flow (with PKCE).

Only talks to the providers: builds the authorization URL, exchanges the code, and
returns a normalized :class:`OAuthProfile`. Linking the profile to an account and
issuing sessions lives in ``auth_service``.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlencode

import httpx

from app.config import OAuthClientSettings, get_oauth_client_settings
from app.services.errors import DataServiceError, MissingConfigError


Provider = Literal["google", "github"]
PROVIDERS: tuple[Provider, ...] = ("google", "github")
HTTP_TIMEOUT_SECONDS = 10.0


class OAuthError(DataServiceError):
    """The provider rejected the sign-in or returned something unusable."""


@dataclass(frozen=True)
class OAuthProfile:
    provider: Provider
    provider_user_id: str
    email: str | None
    email_verified: bool
    name: str | None


@dataclass(frozen=True)
class _ProviderEndpoints:
    authorize_url: str
    token_url: str
    scope: str


_ENDPOINTS: dict[Provider, _ProviderEndpoints] = {
    "google": _ProviderEndpoints(
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        scope="openid email profile",
    ),
    "github": _ProviderEndpoints(
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        scope="read:user user:email",
    ),
}


def is_provider(value: str) -> bool:
    return value in PROVIDERS


def new_state() -> str:
    return secrets.token_urlsafe(32)


def new_code_verifier() -> str:
    return secrets.token_urlsafe(64)


def build_authorization_url(provider: Provider, *, redirect_uri: str, state: str, code_verifier: str) -> str:
    client = _client_settings(provider)
    endpoints = _ENDPOINTS[provider]
    params = {
        "client_id": client.client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": endpoints.scope,
        "state": state,
        "code_challenge": _code_challenge(code_verifier),
        "code_challenge_method": "S256",
    }
    if provider == "google":
        params["prompt"] = "select_account"
    else:
        params["allow_signup"] = "true"
    return f"{endpoints.authorize_url}?{urlencode(params)}"


def fetch_profile(provider: Provider, *, code: str, redirect_uri: str, code_verifier: str) -> OAuthProfile:
    """Exchange an authorization code and read the signed-in provider account."""
    client = _client_settings(provider)
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as http:
            access_token = _exchange_code(
                http, provider, client, code=code, redirect_uri=redirect_uri, code_verifier=code_verifier
            )
            if provider == "google":
                return _google_profile(http, access_token)
            return _github_profile(http, access_token)
    except httpx.HTTPError as exc:
        raise OAuthError(f"Could not reach {provider.title()}. Try again.") from exc


def _exchange_code(
    http: httpx.Client,
    provider: Provider,
    client: OAuthClientSettings,
    *,
    code: str,
    redirect_uri: str,
    code_verifier: str,
) -> str:
    data = {
        "client_id": client.client_id,
        "client_secret": client.client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    payload = _json(http.post(_ENDPOINTS[provider].token_url, data=data, headers={"Accept": "application/json"}))
    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        # GitHub answers 200 with {"error": ...} on a bad or expired code.
        raise OAuthError(f"{provider.title()} did not accept the sign-in: {payload.get('error') or 'no access token'}")
    return access_token


def _google_profile(http: httpx.Client, access_token: str) -> OAuthProfile:
    info = _json(
        http.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    )
    subject = info.get("sub")
    if not subject:
        raise OAuthError("Google did not return an account id.")
    email = info.get("email")
    return OAuthProfile(
        provider="google",
        provider_user_id=str(subject),
        email=email if isinstance(email, str) and email else None,
        email_verified=info.get("email_verified") is True,
        name=info.get("name") if isinstance(info.get("name"), str) else None,
    )


def _github_profile(http: httpx.Client, access_token: str) -> OAuthProfile:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    user = _json(http.get("https://api.github.com/user", headers=headers))
    if not user.get("id"):
        raise OAuthError("GitHub did not return an account id.")

    # /user only shows the public email; /user/emails says which addresses are verified.
    emails = _json(http.get("https://api.github.com/user/emails", headers=headers))
    verified = [entry for entry in emails if isinstance(entry, dict) and entry.get("verified") and entry.get("email")]
    primary = next((entry for entry in verified if entry.get("primary")), verified[0] if verified else None)

    return OAuthProfile(
        provider="github",
        provider_user_id=str(user["id"]),
        email=primary["email"] if primary else None,
        email_verified=primary is not None,
        name=(user.get("name") or user.get("login")) or None,
    )


def _json(response: httpx.Response):
    if response.status_code >= 400:
        raise OAuthError(f"Sign-in provider returned HTTP {response.status_code}.")
    try:
        return response.json()
    except ValueError as exc:
        raise OAuthError("Sign-in provider returned an unreadable response.") from exc


def _client_settings(provider: Provider) -> OAuthClientSettings:
    settings = get_oauth_client_settings(provider)
    if settings is None:
        raise MissingConfigError(f"{provider.title()} sign-in is not configured.")
    return settings


def _code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
