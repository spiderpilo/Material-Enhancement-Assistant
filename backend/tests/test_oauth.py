from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import pytest

from app.services import db, oauth_service
from app.services.oauth_service import OAuthProfile
from tests.conftest import auth_header, register


FRONTEND = "http://frontend.test"


@pytest.fixture(autouse=True)
def oauth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_URL", FRONTEND)
    monkeypatch.delenv("OAUTH_REDIRECT_BASE_URL", raising=False)
    for provider in ("GOOGLE", "GITHUB"):
        monkeypatch.setenv(f"{provider}_OAUTH_CLIENT_ID", f"{provider.lower()}-client")
        monkeypatch.setenv(f"{provider}_OAUTH_CLIENT_SECRET", f"{provider.lower()}-secret")


@pytest.fixture()
def provider_profile(monkeypatch: pytest.MonkeyPatch):
    """Replace the provider round-trip; tests set ``holder["profile"]`` to what it returns."""
    holder: dict[str, OAuthProfile] = {
        "profile": OAuthProfile(
            provider="google",
            provider_user_id="google-123",
            email="Prof@Example.com",
            email_verified=True,
            name="Pat Prof",
        )
    }
    calls: list[dict] = []

    def fake_fetch_profile(provider, *, code, redirect_uri, code_verifier):
        calls.append({"provider": provider, "code": code, "redirect_uri": redirect_uri, "code_verifier": code_verifier})
        return holder["profile"]

    monkeypatch.setattr(oauth_service, "fetch_profile", fake_fetch_profile)
    holder["calls"] = calls  # type: ignore[assignment]
    return holder


def start(client, provider: str = "google") -> str:
    response = client.get(f"/oauth/{provider}/authorize", follow_redirects=False)
    assert response.status_code == 307, response.text
    return parse_qs(urlsplit(response.headers["location"]).query)["state"][0]


def finish(client, provider: str = "google", *, state: str, **params) -> dict[str, str]:
    response = client.get(
        f"/oauth/{provider}/callback",
        params={"code": "provider-code", "state": state, **params},
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    location = urlsplit(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == f"{FRONTEND}/auth/callback"
    return {key: values[0] for key, values in parse_qs(location.fragment).items()}


def sign_in(client, provider: str = "google") -> dict[str, str]:
    return finish(client, provider, state=start(client, provider))


def complete_signup(client, ticket: str, *, username: str = "pat", profession: str = "student"):
    return client.post(
        "/oauth/complete-signup",
        json={"ticket": ticket, "username": username, "profession": profession},
    )


def test_authorize_redirects_to_provider_with_state_and_pkce(client):
    response = client.get("/oauth/google/authorize", follow_redirects=False)

    location = urlsplit(response.headers["location"])
    query = parse_qs(location.query)
    assert location.netloc == "accounts.google.com"
    assert query["client_id"] == ["google-client"]
    assert query["redirect_uri"] == ["http://testserver/oauth/google/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["state"][0]
    cookie = response.headers["set-cookie"]
    assert "mea_oauth_state=" in cookie and "HttpOnly" in cookie and "Path=/oauth" in cookie


def test_github_authorize_asks_for_email_scope(client):
    response = client.get("/oauth/github/authorize", follow_redirects=False)

    query = parse_qs(urlsplit(response.headers["location"]).query)
    assert urlsplit(response.headers["location"]).netloc == "github.com"
    assert "user:email" in query["scope"][0]


def test_redirect_base_url_overrides_request_host(client, monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", "https://api.example.com/")

    response = client.get("/oauth/google/authorize", follow_redirects=False)

    assert parse_qs(urlsplit(response.headers["location"]).query)["redirect_uri"] == [
        "https://api.example.com/oauth/google/callback"
    ]
    assert "Secure" in response.headers["set-cookie"]


def test_unconfigured_provider_sends_user_back_with_error(client, monkeypatch):
    monkeypatch.delenv("GITHUB_OAUTH_CLIENT_SECRET")

    response = client.get("/oauth/github/authorize", follow_redirects=False)

    assert response.status_code == 303
    fragment = parse_qs(urlsplit(response.headers["location"]).fragment)
    assert "not available" in fragment["error"][0]


def test_unknown_provider_is_rejected(client):
    assert client.get("/oauth/facebook/authorize", follow_redirects=False).status_code == 422


def test_new_user_gets_signup_ticket_then_creates_account(client, provider_profile):
    fragment = sign_in(client)

    assert set(fragment) == {"signup", "email", "name"}
    assert fragment["email"] == "Prof@Example.com"
    assert provider_profile["calls"][0]["redirect_uri"] == "http://testserver/oauth/google/callback"
    assert db.fetch_one("SELECT count(*) AS n FROM public.auth_users")["n"] == 0

    created = complete_signup(client, fragment["signup"])
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["email"] == "prof@example.com"
    assert body["username"] == "pat"
    assert body["profession"] == "student"
    assert client.get("/me", headers=auth_header(body["access_token"])).status_code == 200

    identity = db.fetch_one("SELECT provider, provider_user_id, user_id FROM public.auth_identities")
    assert identity["provider"] == "google" and identity["provider_user_id"] == "google-123"
    assert str(identity["user_id"]) == body["user_id"]


def test_returning_user_gets_single_use_login_code(client, provider_profile):
    complete_signup(client, sign_in(client)["signup"])

    fragment = sign_in(client)
    assert set(fragment) == {"code"}

    exchanged = client.post("/oauth/exchange", json={"code": fragment["code"]})
    assert exchanged.status_code == 200, exchanged.text
    tokens = exchanged.json()
    assert tokens["username"] == "pat"
    assert client.get("/me", headers=auth_header(tokens["access_token"])).status_code == 200

    # Replaying the code is treated like refresh-token reuse: the session ends.
    replay = client.post("/oauth/exchange", json={"code": fragment["code"]})
    assert replay.status_code == 401
    assert client.get("/me", headers=auth_header(tokens["access_token"])).status_code == 401


def test_login_code_is_not_a_refresh_token(client, provider_profile):
    complete_signup(client, sign_in(client)["signup"])
    code = sign_in(client)["code"]

    assert client.post("/refresh-token", json={"refresh_token": code}).status_code == 401


def test_verified_email_links_existing_password_account(client, provider_profile):
    registered = register(client)

    fragment = sign_in(client)
    tokens = client.post("/oauth/exchange", json={"code": fragment["code"]}).json()

    assert tokens["user_id"] == registered["user_id"]
    assert tokens["username"] == "prof"
    # The password keeps working next to the linked provider.
    login = client.post("/login-account", json={"email": "prof@example.com", "password": "correct-horse-1"})
    assert login.status_code == 200


def test_github_and_google_link_to_the_same_account(client, provider_profile):
    complete_signup(client, sign_in(client)["signup"])
    provider_profile["profile"] = OAuthProfile(
        provider="github", provider_user_id="42", email="prof@example.com", email_verified=True, name="pat"
    )

    fragment = sign_in(client, "github")

    assert set(fragment) == {"code"}
    assert db.fetch_one("SELECT count(DISTINCT user_id) AS n FROM public.auth_identities")["n"] == 1


def test_unverified_email_is_refused(client, provider_profile):
    register(client)
    provider_profile["profile"] = OAuthProfile(
        provider="github", provider_user_id="7", email="prof@example.com", email_verified=False, name="x"
    )

    fragment = sign_in(client, "github")

    assert "verified email" in fragment["error"]
    assert db.fetch_one("SELECT count(*) AS n FROM public.auth_identities")["n"] == 0


def test_state_mismatch_is_rejected_without_calling_provider(client, provider_profile):
    start(client)

    fragment = finish(client, state="forged-state")

    assert "expired" in fragment["error"]
    assert provider_profile["calls"] == []


def test_callback_without_state_cookie_is_rejected(client, provider_profile):
    state = start(client)
    client.cookies.clear()

    assert "error" in finish(client, state=state)
    assert provider_profile["calls"] == []


def test_state_from_other_provider_is_rejected(client, provider_profile):
    state = start(client, "google")

    assert "error" in finish(client, "github", state=state)


def test_cancelled_consent_shows_message(client):
    state = start(client)

    fragment = finish(client, state=state, error="access_denied")

    assert fragment == {"error": "Sign-in was cancelled."}


def test_oauth_only_user_cannot_log_in_with_a_password(client, provider_profile):
    complete_signup(client, sign_in(client)["signup"])

    for password in ("!oauth", "anything-at-all"):
        response = client.post("/login-account", json={"email": "prof@example.com", "password": password.ljust(8, "x")})
        assert response.status_code == 401


def test_signup_ticket_cannot_create_two_accounts(client, provider_profile):
    ticket = sign_in(client)["signup"]
    assert complete_signup(client, ticket).status_code == 201

    again = complete_signup(client, ticket, username="someone-else")

    assert again.status_code == 409


def test_signup_with_taken_username_leaves_no_partial_account(client, provider_profile):
    register(client, email="other@example.com", username="pat")

    response = complete_signup(client, sign_in(client)["signup"], username="pat")

    assert response.status_code == 409
    assert db.fetch_one("SELECT count(*) AS n FROM public.auth_identities")["n"] == 0
    assert db.fetch_one("SELECT count(*) AS n FROM public.auth_users WHERE email = 'prof@example.com'")["n"] == 0


def test_forged_signup_ticket_is_rejected(client):
    assert complete_signup(client, "not-a-ticket").status_code == 401
