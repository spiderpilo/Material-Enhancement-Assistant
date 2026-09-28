from __future__ import annotations

from types import SimpleNamespace

import httpx2
import openai
import pytest

from app.models.chat_model import ProjectChatMessageRecord
from app.models.quiz_model import QuizSourceMaterial
from app.services import chat_llm_service
from app.services.chat_llm_service import ChatServiceError, answer_project_question, stream_project_answer
from app.services.llm_service import LLMServiceError, MissingAPIKeyError


MATERIALS = [QuizSourceMaterial(id=1, name="Week 3 notes (pages 5-11)", text="Photosynthesis makes glucose.")]


def completion(content: str | None):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def status_error(status: int, message: str) -> openai.APIStatusError:
    request = httpx2.Request("POST", "https://api.deepseek.com/chat/completions")
    error_class = {401: openai.AuthenticationError}.get(status, openai.APIStatusError)
    return error_class(message, response=httpx2.Response(status, request=request), body=None)


def chunk(content: str | None, *, reasoning: str | None = None):
    delta = SimpleNamespace(content=content, reasoning_content=reasoning)
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta)])


class FakeStream:
    def __init__(self, chunks, *, error: Exception | None = None) -> None:
        self.chunks = chunks
        self.error = error
        self.closed = False

    def __iter__(self):
        yield from self.chunks
        if self.error:
            raise self.error

    def close(self) -> None:
        self.closed = True


class FakeCompletions:
    def __init__(self) -> None:
        self.result = completion("  It makes glucose.  ")
        self.stream = FakeStream([chunk("It "), chunk("makes "), chunk("glucose.")])
        self.error: Exception | None = None
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.stream if kwargs.get("stream") else self.result


@pytest.fixture()
def fake_deepseek(monkeypatch: pytest.MonkeyPatch) -> FakeCompletions:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.delenv("DEEPSEEK_CHAT_MODEL", raising=False)
    completions = FakeCompletions()
    clients: list[dict] = []

    def fake_client(**kwargs):
        clients.append(kwargs)
        return SimpleNamespace(chat=SimpleNamespace(completions=completions))

    monkeypatch.setattr(chat_llm_service.openai, "OpenAI", fake_client)
    completions.clients = clients  # type: ignore[attr-defined]
    return completions


def history(*pairs: tuple[str, str]) -> list[ProjectChatMessageRecord]:
    return [
        ProjectChatMessageRecord.model_validate(
            {"id": f"m{i}", "role": role, "content": content, "timestamp": "2026-09-27T00:00:00Z"}
        )
        for i, (role, content) in enumerate(pairs)
    ]


def test_answer_uses_deepseek_with_documents_and_history(fake_deepseek):
    answer = answer_project_question(
        question="What does it make?",
        materials=MATERIALS,
        history=history(("user", "Tell me about plants"), ("assistant", "Plants photosynthesize.")),
    )

    assert answer == "It makes glucose."
    client = fake_deepseek.clients[0]
    assert client["base_url"] == "https://api.deepseek.com"
    assert client["api_key"] == "sk-test"
    call = fake_deepseek.calls[0]
    assert call["model"] == "deepseek-v4-pro"
    system, user = call["messages"]
    assert system["role"] == "system" and "answers only from the provided course documents" in system["content"]
    assert "USER: Tell me about plants" in user["content"]
    assert "Current question:\nWhat does it make?" in user["content"]
    assert "Source header: Week 3 notes (pages 5-11)" in user["content"]


def test_chat_model_is_configurable(fake_deepseek, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_CHAT_MODEL", "deepseek-flash")

    answer_project_question(question="q", materials=MATERIALS)

    assert fake_deepseek.calls[0]["model"] == "deepseek-flash"


def test_missing_key_is_reported(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")

    with pytest.raises(MissingAPIKeyError, match="DEEPSEEK_API_KEY"):
        answer_project_question(question="q", materials=MATERIALS)


def test_empty_answer_is_an_error(fake_deepseek):
    fake_deepseek.result = completion("   ")

    with pytest.raises(ChatServiceError, match="empty"):
        answer_project_question(question="q", materials=MATERIALS)


def test_bad_key_becomes_llm_service_error(fake_deepseek):
    fake_deepseek.error = status_error(401, "bad key")

    with pytest.raises(LLMServiceError, match="DEEPSEEK_API_KEY"):
        answer_project_question(question="q", materials=MATERIALS)


def test_insufficient_balance_is_explained(fake_deepseek):
    fake_deepseek.error = status_error(402, "Insufficient Balance")

    with pytest.raises(ChatServiceError, match="out of credits"):
        answer_project_question(question="q", materials=MATERIALS)


def test_requires_at_least_one_source(fake_deepseek):
    with pytest.raises(ChatServiceError):
        answer_project_question(question="q", materials=[])
    assert fake_deepseek.calls == []


def test_stream_yields_answer_text_in_order(fake_deepseek):
    fake_deepseek.stream = FakeStream([chunk(None, reasoning="thinking..."), chunk("It "), chunk(""), chunk("makes glucose.")])

    parts = list(stream_project_answer(question="What does it make?", materials=MATERIALS))

    assert parts == ["It ", "makes glucose."]
    call = fake_deepseek.calls[0]
    assert call["stream"] is True
    assert call["model"] == "deepseek-v4-pro"
    assert "Current question:\nWhat does it make?" in call["messages"][1]["content"]
    assert fake_deepseek.stream.closed


def test_stream_does_nothing_until_iterated(fake_deepseek):
    stream_project_answer(question="q", materials=MATERIALS)

    assert fake_deepseek.calls == []


def test_stream_maps_request_errors(fake_deepseek):
    fake_deepseek.error = status_error(402, "Insufficient Balance")

    with pytest.raises(ChatServiceError, match="out of credits"):
        list(stream_project_answer(question="q", materials=MATERIALS))


def test_stream_maps_errors_raised_mid_answer(fake_deepseek):
    fake_deepseek.stream = FakeStream([chunk("It ")], error=status_error(500, "boom"))
    stream = stream_project_answer(question="q", materials=MATERIALS)

    assert next(stream) == "It "
    with pytest.raises(ChatServiceError, match="DeepSeek request failed"):
        next(stream)
    assert fake_deepseek.stream.closed


def test_stream_requires_key(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")

    with pytest.raises(MissingAPIKeyError, match="DEEPSEEK_API_KEY"):
        list(stream_project_answer(question="q", materials=MATERIALS))
