from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import OPENAPI_TAGS, app
from tests.test_auth import PUBLIC_OPERATIONS


@pytest.fixture(scope="module")
def schema() -> dict:
    return TestClient(app).get("/openapi.json").json()


def _operations(schema: dict):
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            yield method, path, operation


def test_bearer_security_scheme_is_declared(schema):
    scheme = schema["components"]["securitySchemes"]["BearerAuth"]
    assert scheme["type"] == "http"
    assert scheme["scheme"] == "bearer"
    assert scheme["bearerFormat"] == "JWT"


def test_protected_operations_declare_security_and_401(schema):
    for method, path, operation in _operations(schema):
        if (method, path) in PUBLIC_OPERATIONS:
            assert "security" not in operation, f"{method} {path} should be public"
            continue
        assert operation.get("security") == [{"BearerAuth": []}], f"{method} {path} missing security"
        assert "401" in operation["responses"], f"{method} {path} missing 401 response"


def test_every_operation_has_a_known_tag_and_summary(schema):
    known_tags = {tag["name"] for tag in OPENAPI_TAGS}
    for method, path, operation in _operations(schema):
        assert len(operation.get("tags", [])) == 1, f"{method} {path} tags={operation.get('tags')}"
        assert operation["tags"][0] in known_tags, f"{method} {path} unknown tag"
        assert operation.get("summary"), f"{method} {path} missing summary"


def test_authentication_tag_groups_session_endpoints(schema):
    auth_paths = {
        path for method, path, operation in _operations(schema) if operation["tags"] == ["Authentication"]
    }
    assert auth_paths == {"/create-account", "/login-account", "/refresh-token", "/logout", "/me"}


def test_login_and_create_account_document_token_fields(schema):
    for name in ("LoginAccountResponse", "CreateAccountResponse"):
        properties = schema["components"]["schemas"][name]["properties"]
        for field in ("access_token", "refresh_token", "token_type", "expires_in", "refresh_expires_in"):
            assert field in properties, f"{name}.{field}"


def test_no_operation_exposes_a_raw_authorization_header_parameter(schema):
    for method, path, operation in _operations(schema):
        header_params = [p["name"].lower() for p in operation.get("parameters", []) if p["in"] == "header"]
        assert "authorization" not in header_params, f"{method} {path}"
