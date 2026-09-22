from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.services import db
from tests.conftest import auth_header, register


PUBLIC_OPERATIONS = {
    ("post", "/create-account"),
    ("post", "/login-account"),
    ("post", "/refresh-token"),
    ("get", "/"),
    ("get", "/health"),
    ("get", "/health/db"),
}


def login(client, *, email: str = "prof@example.com", password: str = "correct-horse-1"):
    return client.post("/login-account", json={"email": email, "password": password})


def test_create_account_returns_tokens_and_profile(client):
    body = register(client)

    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]
    assert body["expires_in"] == 900
    assert body["refresh_expires_in"] == 86400
    assert body["email"] == "prof@example.com"
    assert body["username"] == "prof"
    assert body["profession"] == "professor"
    assert body["user_id"] == body["auth_user_id"]
    assert body["profile"]["username"] == "prof"

    me = client.get("/me", headers=auth_header(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["user_id"] == body["user_id"]


def test_password_is_stored_as_bcrypt_hash(client):
    register(client)
    row = db.fetch_one("SELECT encrypted_password FROM public.auth_users WHERE email = %s", ("prof@example.com",))
    assert row["encrypted_password"].startswith("$2")
    assert "correct-horse-1" not in row["encrypted_password"]


def test_login_returns_tokens_and_rejects_bad_password(client):
    register(client)

    ok = login(client)
    assert ok.status_code == 200
    assert ok.json()["access_token"] and ok.json()["refresh_token"]
    assert ok.json()["expires_in"] == 900

    bad = login(client, password="wrong-password")
    assert bad.status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer"},
        {"Authorization": "Bearer not-a-jwt"},
        {"Authorization": "Basic Zm9vOmJhcg=="},
    ],
)
def test_protected_endpoint_rejects_missing_or_malformed_token(client, headers):
    response = client.get("/projects", headers=headers)
    assert response.status_code == 401
    assert response.headers.get("www-authenticate", "").lower().startswith("bearer")


def test_expired_and_forged_access_tokens_are_rejected(client):
    body = register(client)
    claims = jwt.decode(body["access_token"], options={"verify_signature": False})

    expired_claims = {**claims, "exp": datetime.now(timezone.utc) - timedelta(seconds=5)}
    expired = jwt.encode(expired_claims, "test-secret-" + "x" * 40, algorithm="HS256")
    assert client.get("/projects", headers=auth_header(expired)).status_code == 401

    forged = jwt.encode(claims, "some-other-secret-" + "y" * 40, algorithm="HS256")
    assert client.get("/projects", headers=auth_header(forged)).status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client):
    body = register(client)
    assert client.get("/projects", headers=auth_header(body["refresh_token"])).status_code == 401


def test_refresh_rotates_and_detects_reuse(client):
    body = register(client)

    first = client.post("/refresh-token", json={"refresh_token": body["refresh_token"]})
    assert first.status_code == 200
    rotated = first.json()
    assert rotated["refresh_token"] != body["refresh_token"]
    assert client.get("/projects", headers=auth_header(rotated["access_token"])).status_code == 200

    # Replaying the old refresh token is treated as theft: the whole session is revoked.
    replay = client.post("/refresh-token", json={"refresh_token": body["refresh_token"]})
    assert replay.status_code == 401
    assert client.post("/refresh-token", json={"refresh_token": rotated["refresh_token"]}).status_code == 401
    assert client.get("/projects", headers=auth_header(rotated["access_token"])).status_code == 401


def test_logout_revokes_access_and_refresh_tokens_for_that_session_only(client):
    register(client)
    browser_a = login(client).json()
    browser_b = login(client).json()

    logout = client.post("/logout", headers=auth_header(browser_a["access_token"]))
    assert logout.status_code == 204

    assert client.get("/projects", headers=auth_header(browser_a["access_token"])).status_code == 401
    assert client.post("/refresh-token", json={"refresh_token": browser_a["refresh_token"]}).status_code == 401

    assert client.get("/projects", headers=auth_header(browser_b["access_token"])).status_code == 200
    assert client.post("/refresh-token", json={"refresh_token": browser_b["refresh_token"]}).status_code == 200


def test_logout_requires_authentication(client):
    assert client.post("/logout").status_code == 401


def test_every_non_public_operation_requires_a_token(client):
    schema = client.get("/openapi.json").json()
    checked = 0
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            if (method, path) in PUBLIC_OPERATIONS:
                continue
            concrete_path = (
                path.replace("{project_uuid}", "00000000-0000-0000-0000-000000000000")
                .replace("{generated_material_uuid}", "00000000-0000-0000-0000-000000000000")
                .replace("{course_content_id}", "1")
            )
            response = client.request(method.upper(), concrete_path)
            assert response.status_code == 401, f"{method.upper()} {path} returned {response.status_code}"
            checked += 1
    assert checked >= 15


def test_other_users_cannot_read_a_project(client):
    owner = register(client)
    intruder = register(client, email="other@example.com", username="other")

    created = client.post("/projects", json={"name": "Owner project"}, headers=auth_header(owner["access_token"]))
    project_uuid = created.json()["project_uuid"]

    for path in (f"/projects/{project_uuid}", f"/projects/{project_uuid}/chat"):
        assert client.get(path, headers=auth_header(intruder["access_token"])).status_code == 404
