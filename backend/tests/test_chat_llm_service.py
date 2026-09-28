from __future__ import annotations

from types import SimpleNamespace

import httpx2
import openai
import pytest

from app.models.chat_model import ProjectChatMessageRecord
from app.models.quiz_model import QuizSourceMaterial
from app.services import chat_llm_service
from app.services.chat_llm_service import OpenAIServiceError, answer_project_question
from app.services.llm_service import LLMServiceError, MissingAPIKeyError


MATERIALS = [QuizSourceMaterial(id=1, name="Week 3 notes (pages 5-11)", text="Photosynthesis makes glucose.")]


class FakeResponses:
    def __init__(self, result=None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


@pytest.fixture()
def fake_openai(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("OPENAI_CHAT_MODEL", raising=False)
    responses = FakeResponses(result=SimpleNamespace(output_text="  It makes glucose.  "))
    clients: list[dict] = []

    def fake_client(**kwargs):
        clients.append(kwargs)
        return SimpleNamespace(responses=responses)

    monkeypatch.setattr(chat_llm_service.openai, "OpenAI", fake_client)
    responses.clients = clients  # type: ignore[attr-defined]
    return responses


def history(*pairs: tuple[str, str]) -> list[ProjectChatMessageRecord]:
    return [
        ProjectChatMessageRecord.model_validate({"id": f"m{i}", "role": role, "content": content, "timestamp": "2026-09-27T00:00:00Z"})
        for i, (role, content) in enumerate(pairs)
    ]


def test_answer_uses_openai_responses_with_documents_and_history(fake_openai):
    answer = answer_project_question(
        question="What does it make?",
        materials=MATERIALS,
        history=history(("user", "Tell me about plants"), ("assistant", "Plants photosynthesize.")),
    )

    assert answer == "It makes glucose."
    call = fake_openai.calls[0]
    assert call["model"] == "gpt-5.5"
    assert "answers only from the provided course documents" in call["instructions"]
    assert "USER: Tell me about plants" in call["input"]
    assert "Current question:\nWhat does it make?" in call["input"]
    assert "Source header: Week 3 notes (pages 5-11)" in call["input"]
    assert fake_openai.clients[0]["api_key"] == "sk-test"


def test_chat_model_is_configurable(fake_openai, monkeypatch):
    monkeypatch.setenv("OPENAI_CHAT_MODEL", "gpt-6-sol")

    answer_project_question(question="q", materials=MATERIALS)

    assert fake_openai.calls[0]["model"] == "gpt-6-sol"


def test_missing_key_is_reported(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "")

    with pytest.raises(MissingAPIKeyError, match="OPENAI_API_KEY"):
        answer_project_question(question="q", materials=MATERIALS)


def test_empty_answer_is_an_error(fake_openai):
    fake_openai.result = SimpleNamespace(output_text="   ")

    with pytest.raises(OpenAIServiceError, match="empty"):
        answer_project_question(question="q", materials=MATERIALS)


def test_provider_errors_become_llm_service_errors(fake_openai):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    fake_openai.error = openai.AuthenticationError(
        "bad key", response=httpx2.Response(401, request=request), body=None
    )

    with pytest.raises(LLMServiceError, match="OPENAI_API_KEY"):
        answer_project_question(question="q", materials=MATERIALS)


def test_out_of_credit_is_explained(fake_openai):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    fake_openai.error = openai.RateLimitError(
        "no credits",
        response=httpx2.Response(429, request=request),
        body={"code": "credit_balance_exhausted", "type": "insufficient_quota", "message": "no credits"},
    )

    with pytest.raises(OpenAIServiceError, match="out of credits"):
        answer_project_question(question="q", materials=MATERIALS)


def test_requires_at_least_one_source(fake_openai):
    with pytest.raises(OpenAIServiceError):
        answer_project_question(question="q", materials=[])
    assert fake_openai.calls == []
