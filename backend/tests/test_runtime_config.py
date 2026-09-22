from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_CORS_ALLOWED_ORIGINS, get_cors_allowed_origins
from app.main import app


def test_health_reports_status_and_version(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("APP_VERSION", "abc1234")

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "abc1234"}


def test_health_version_defaults_to_dev(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("APP_VERSION", raising=False)

    assert TestClient(app).get("/health").json()["version"] == "dev"


def test_cors_origins_default_to_local_frontend(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    assert get_cors_allowed_origins() == list(DEFAULT_CORS_ALLOWED_ORIGINS)


def test_cors_origins_parse_comma_separated_list(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", " https://mea.onrender.com/ , http://localhost:3000,,")

    assert get_cors_allowed_origins() == ["https://mea.onrender.com", "http://localhost:3000"]


def test_cors_preflight_allows_configured_local_origin():
    response = TestClient(app).options(
        "/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_db_health_is_ok_when_database_answers(client: TestClient):
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_health_hides_error_details_when_database_is_down(monkeypatch: pytest.MonkeyPatch):
    from app.services import db
    from app.services.errors import DataServiceError

    def failing_fetch(*args, **kwargs):
        raise DataServiceError("could not connect to server at secret-host.neon.tech")

    monkeypatch.setattr(db, "fetch_one", failing_fetch)

    response = TestClient(app).get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
