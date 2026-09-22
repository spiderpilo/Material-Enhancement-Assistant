"""Regression budgets for the read paths that were slow after the Neon migration.

Each statement is a network round trip to Neon (~150-200 ms from a laptop), so the
number of statements per request, not the query plans, dominated latency.
"""

from __future__ import annotations

import inspect

import pytest

from app.main import app
from app.services import db
from tests.conftest import TEST_PUBLIC_URL, auth_header, register


def seed_project(client, token: str, *, name: str, material_count: int, preview_status: str = "ready") -> dict:
    project = client.post("/projects", json={"name": name}, headers=auth_header(token)).json()
    for index in range(material_count):
        key = f"course-contents/{project['project_uuid']}-{index}/file-{index}.pdf"
        row = db.fetch_one(
            """
            INSERT INTO public.course_contents
                (material_name, access_url, data_size, project_id, content_sha256,
                 source_type, preview_status, preview_count, rag_status)
            VALUES (%s, %s, 100, %s, %s, 'pdf', %s, 2, 'ready')
            RETURNING id
            """,
            (f"file-{index}.pdf", f"{TEST_PUBLIC_URL}/{key}", project["id"], f"sha-{project['id']}-{index}", preview_status),
        )
        db.execute(
            "INSERT INTO public.project_materials (project_id, material_id) VALUES (%s, %s)",
            (project["id"], row["id"]),
        )
    return project


@pytest.fixture()
def signed_in(client):
    return register(client)["access_token"]


def test_list_projects_uses_constant_queries(client, signed_in, query_counter, fake_storage):
    for index in range(5):
        seed_project(client, signed_in, name=f"Project {index}", material_count=index)

    query_counter.reset()
    fake_storage.get_calls = 0
    response = client.get("/projects", headers=auth_header(signed_in))

    assert response.status_code == 200
    projects = response.json()["projects"]
    assert [p["material_count"] for p in projects] == [4, 3, 2, 1, 0]
    assert projects[0]["last_updated"] is not None
    assert projects[-1]["last_updated"] is None
    assert query_counter.count <= 2, query_counter.statements
    assert fake_storage.get_calls == 0


def test_list_projects_limit(client, signed_in):
    for index in range(3):
        seed_project(client, signed_in, name=f"Project {index}", material_count=0)

    response = client.get("/projects?limit=2", headers=auth_header(signed_in))
    assert [p["name"] for p in response.json()["projects"]] == ["Project 2", "Project 1"]


def test_get_project_reads_materials_without_storage_calls(client, signed_in, query_counter, fake_storage):
    project = seed_project(client, signed_in, name="Algorithms", material_count=3)

    query_counter.reset()
    fake_storage.get_calls = 0
    response = client.get(f"/projects/{project['project_uuid']}", headers=auth_header(signed_in))

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Algorithms"
    assert body["material_count"] == 3
    assert {m["material_name"] for m in body["materials"]} == {"file-0.pdf", "file-1.pdf", "file-2.pdf"}
    assert all(m["preview_status"] == "ready" and m["preview_count"] == 2 for m in body["materials"])
    assert all(m["source_type"] == "pdf" for m in body["materials"])
    assert query_counter.count <= 2, query_counter.statements
    assert fake_storage.get_calls == 0


def test_chat_history_does_not_load_materials(client, signed_in, query_counter, fake_storage):
    project = seed_project(client, signed_in, name="Chatty", material_count=3)

    query_counter.reset()
    fake_storage.get_calls = 0
    response = client.get(f"/projects/{project['project_uuid']}/chat", headers=auth_header(signed_in))

    assert response.status_code == 200
    assert response.json() == {"messages": []}
    assert query_counter.count <= 2, query_counter.statements
    assert fake_storage.get_calls == 0


def test_preview_status_comes_from_database_when_manifest_missing(client, signed_in, fake_storage):
    project = seed_project(client, signed_in, name="P", material_count=1, preview_status="failed")
    material_id = client.get(f"/projects/{project['project_uuid']}", headers=auth_header(signed_in)).json()[
        "materials"
    ][0]["id"]

    response = client.get(f"/course-contents/{material_id}/preview", headers=auth_header(signed_in))

    assert response.status_code == 200
    assert response.json()["preview_status"] == "failed"


def test_blocking_handlers_are_not_coroutines():
    """Sync I/O inside ``async def`` stalls the whole event loop (every other request waits)."""
    blocking = {"get_course_content_preview_manifest", "get_course_content_file"}
    for route in app.routes:
        if getattr(route, "name", None) in blocking:
            assert not inspect.iscoroutinefunction(route.endpoint), route.name


def test_pooled_connection_is_not_pinged_when_recently_used(clean_db, monkeypatch):
    db.fetch_all("SELECT 1")
    pings = []
    original = db._is_connection_alive
    monkeypatch.setattr(db, "_is_connection_alive", lambda connection: pings.append(1) or original(connection))

    for _ in range(3):
        db.fetch_all("SELECT 1")

    assert pings == []


def _insert_generated_material(project_uuid: str, *, tool_type: str, payload: dict) -> None:
    db.execute(
        """
        INSERT INTO public.generated_materials (project_uuid, name, file_location, tool_type, payload)
        VALUES (%s::uuid, 'generated', 'inline://payload', %s, %s)
        """,
        (project_uuid, tool_type, db.json_param(payload)),
    )


def test_generated_materials_listing_uses_constant_queries(client, signed_in, query_counter):
    project = seed_project(client, signed_in, name="Quizzes", material_count=0)
    quiz = {
        "quiz_id": "quiz-1",
        "title": "Quiz",
        "source_count": 1,
        "questions": [
            {
                "id": f"q{number}",
                "prompt": f"Question {number}?",
                "options": [
                    {"id": option, "label": option.upper(), "text": option, "explanation": "why"}
                    for option in "abcd"
                ],
                "correct_option_id": "a",
                "explanation": "because",
            }
            for number in range(12)
        ],
    }
    _insert_generated_material(project["project_uuid"], tool_type="quiz", payload=quiz)
    _insert_generated_material(project["project_uuid"], tool_type="slide_deck", payload={})

    for query, key in (("?tool=quiz", "generated_quizzes"), ("", "generated_materials")):
        query_counter.reset()
        response = client.get(
            f"/projects/{project['project_uuid']}/generated-materials{query}", headers=auth_header(signed_in)
        )
        assert response.status_code == 200, response.text
        assert len(response.json()[key]) == (1 if query else 2)
        assert query_counter.count <= 2, query_counter.statements


def test_generated_materials_listing_hides_other_users_projects(client, signed_in):
    project = seed_project(client, signed_in, name="Mine", material_count=0)
    other = register(client, email="other@example.com", username="other")["access_token"]

    response = client.get(f"/projects/{project['project_uuid']}/generated-materials", headers=auth_header(other))
    assert response.status_code == 404
