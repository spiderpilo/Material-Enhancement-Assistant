from __future__ import annotations

import json

import pytest

from app.services import data_service, db
from app.services.chat_llm_service import ChatServiceError
from tests.conftest import auth_header, register


EMBEDDING = [0.1] * 768


def read_events(response) -> list[dict]:
    assert response.headers["content-type"].startswith("text/event-stream")
    return [json.loads(block.removeprefix("data: ")) for block in response.text.split("\n\n") if block.strip()]


@pytest.fixture()
def owner(client):
    return register(client)


@pytest.fixture()
def project_uuid(client, owner) -> str:
    created = client.post("/projects", json={"name": "Biology"}, headers=auth_header(owner["access_token"]))
    return created.json()["project_uuid"]


def add_material(project_uuid: str, *, name: str = "Week 3 notes.pdf", rag_status: str = "ready") -> int:
    project = db.fetch_one("SELECT id FROM public.projects WHERE project_uuid = %s::uuid", (project_uuid,))
    material = db.fetch_one(
        """
        INSERT INTO public.course_contents (material_name, access_url, data_size, project_uuid, project_id, rag_status)
        VALUES (%s, 'https://storage.test/test-bucket/notes.pdf', 10, %s::uuid, %s, %s)
        RETURNING id
        """,
        (name, project_uuid, project["id"], rag_status),
    )
    db.execute(
        "INSERT INTO public.project_materials (project_id, material_id) VALUES (%s, %s)",
        (project["id"], material["id"]),
    )
    db.execute(
        """
        INSERT INTO public.course_content_chunks
            (project_id, course_content_id, material_name, chunk_index, text, embedding, location_kind, location_start, location_end)
        VALUES (%s, %s, %s, 0, 'Photosynthesis makes glucose.', %s::public.vector, 'page', 5, 6)
        """,
        (project["id"], material["id"], name, str(EMBEDDING)),
    )
    return material["id"]


@pytest.fixture()
def fake_answer(monkeypatch: pytest.MonkeyPatch) -> dict:
    captured: dict = {"parts": ["Plants ", "make glucose."], "error": None}

    def stream_answer(**kwargs):
        captured["kwargs"] = kwargs
        yield from captured["parts"]
        if captured["error"]:
            raise captured["error"]

    monkeypatch.setattr(data_service, "embed_text", lambda _text: EMBEDDING)
    monkeypatch.setattr(data_service, "stream_project_chat_answer", stream_answer)
    return captured


def ask(client, owner, project_uuid: str, message: str = "What do plants make?", **body):
    return client.post(
        f"/projects/{project_uuid}/chat/stream",
        json={"message": message, **body},
        headers=auth_header(owner["access_token"]),
    )


def test_answer_streams_phases_sources_text_then_saved_conversation(client, owner, project_uuid, fake_answer):
    material_id = add_material(project_uuid)

    events = read_events(ask(client, owner, project_uuid, selected_material_ids=[material_id]))

    assert [event["type"] for event in events] == ["status", "sources", "status", "delta", "delta", "done"]
    assert events[0]["phase"] == "searching"
    assert events[1]["selection_mode"] == "rag_selected"
    assert events[1]["sources"][0]["material_name"] == "Week 3 notes.pdf"
    assert events[2]["phase"] == "writing"
    assert "".join(event["text"] for event in events if event["type"] == "delta") == "Plants make glucose."
    saved = events[-1]["messages"]
    assert [(message["role"], message["content"]) for message in saved] == [
        ("user", "What do plants make?"),
        ("assistant", "Plants make glucose."),
    ]
    assert fake_answer["kwargs"]["question"] == "What do plants make?"
    assert "Photosynthesis makes glucose." in fake_answer["kwargs"]["materials"][0].text

    history = client.get(f"/projects/{project_uuid}/chat", headers=auth_header(owner["access_token"])).json()
    assert [message["content"] for message in history["messages"]] == ["What do plants make?", "Plants make glucose."]


def test_follow_up_questions_receive_earlier_turns(client, owner, project_uuid, fake_answer):
    add_material(project_uuid)
    read_events(ask(client, owner, project_uuid))

    read_events(ask(client, owner, project_uuid, message="And animals?"))

    assert [message.content for message in fake_answer["kwargs"]["history"]] == [
        "What do plants make?",
        "Plants make glucose.",
    ]


def test_unindexed_sources_stream_the_unavailable_notice(client, owner, project_uuid, fake_answer):
    add_material(project_uuid, rag_status="failed")

    events = read_events(ask(client, owner, project_uuid))

    assert [event["type"] for event in events] == ["status", "sources", "delta", "done"]
    assert events[1]["selection_mode"] == "rag_unavailable"
    assert events[2]["text"] == data_service.RAG_UNAVAILABLE_ANSWER
    assert "kwargs" not in fake_answer


def test_failure_mid_answer_becomes_error_event_and_saves_nothing(client, owner, project_uuid, fake_answer):
    add_material(project_uuid)
    fake_answer["parts"] = ["Plants "]
    fake_answer["error"] = ChatServiceError("The DeepSeek account is out of credits, so chat is unavailable.")

    events = read_events(ask(client, owner, project_uuid))

    assert events[-2] == {"type": "delta", "text": "Plants "}
    assert events[-1] == {"type": "error", "detail": "The DeepSeek account is out of credits, so chat is unavailable."}
    history = client.get(f"/projects/{project_uuid}/chat", headers=auth_header(owner["access_token"])).json()
    assert history["messages"] == []


def test_empty_answer_becomes_error_event(client, owner, project_uuid, fake_answer):
    add_material(project_uuid)
    fake_answer["parts"] = ["  "]

    events = read_events(ask(client, owner, project_uuid))

    assert events[-1] == {"type": "error", "detail": "DeepSeek returned an empty response."}


def test_access_errors_are_plain_http_errors_before_streaming(client, owner, project_uuid, fake_answer):
    add_material(project_uuid)
    intruder = register(client, email="other@example.com", username="other")

    response = client.post(
        f"/projects/{project_uuid}/chat/stream",
        json={"message": "hi"},
        headers=auth_header(intruder["access_token"]),
    )
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"

    unknown_source = ask(client, owner, project_uuid, selected_material_ids=[999999])
    assert unknown_source.status_code == 404

    blank = ask(client, owner, project_uuid, message="   ")
    assert blank.status_code == 400
