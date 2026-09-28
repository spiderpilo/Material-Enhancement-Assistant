from __future__ import annotations

import json
from types import SimpleNamespace

import httpx2
import openai
import pytest

from app.models.quiz_model import QuizSourceMaterial
from app.services import slide_deck_llm_service
from app.services.llm_service import LLMServiceError, MissingAPIKeyError
from app.services.slide_deck_llm_service import SlideDeckServiceError, generate_slide_deck_outline_with_usage


MATERIALS = [QuizSourceMaterial(id=1, name="Week 3 notes", text="Photosynthesis makes glucose from light.")]


def completion(payload, *, finish_reason: str = "stop"):
    content = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(
        choices=[SimpleNamespace(finish_reason=finish_reason, message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(prompt_tokens=1200, completion_tokens=800),
    )


def status_error(status: int, message: str) -> openai.APIStatusError:
    request = httpx2.Request("POST", "https://api.cerebras.ai/v1/chat/completions")
    error_class = {401: openai.AuthenticationError}.get(status, openai.APIStatusError)
    return error_class(message, response=httpx2.Response(status, request=request), body=None)


class FakeCompletions:
    def __init__(self) -> None:
        self.result = None
        self.error: Exception | None = None
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


@pytest.fixture()
def fake_cerebras(monkeypatch: pytest.MonkeyPatch) -> FakeCompletions:
    monkeypatch.setenv("CEREBRAS_API_KEY", "csk-test")
    monkeypatch.delenv("CEREBRAS_SLIDE_MODEL", raising=False)
    completions = FakeCompletions()
    clients: list[dict] = []

    def fake_client(**kwargs):
        clients.append(kwargs)
        return SimpleNamespace(chat=SimpleNamespace(completions=completions))

    monkeypatch.setattr(slide_deck_llm_service.openai, "OpenAI", fake_client)
    completions.clients = clients  # type: ignore[attr-defined]
    return completions


def deck(slide_total: int, *, bullets: int = 3) -> dict:
    return {
        "title": "Photosynthesis",
        "subtitle": "How plants make food",
        "slides": [
            {"title": f"Slide {n}", "bullets": [f"Point {b}" for b in range(bullets)], "speaker_notes": "Note"}
            for n in range(slide_total)
        ],
    }


def test_outline_comes_from_cerebras_with_strict_schema(fake_cerebras):
    fake_cerebras.result = completion(deck(3))

    result = generate_slide_deck_outline_with_usage(materials=MATERIALS, slide_count=3)

    assert fake_cerebras.clients[0]["base_url"] == "https://api.cerebras.ai/v1"
    assert fake_cerebras.clients[0]["api_key"] == "csk-test"
    call = fake_cerebras.calls[0]
    assert call["model"] == "gpt-oss-120b"
    assert call["response_format"]["type"] == "json_schema"
    assert call["response_format"]["json_schema"]["strict"] is True
    prompt = call["messages"][0]["content"]
    assert "exactly 3 instructional slides" in prompt
    assert "Source: Week 3 notes" in prompt
    assert result.outline.title == "Photosynthesis"
    assert [slide.title for slide in result.outline.slides] == ["Slide 0", "Slide 1", "Slide 2"]
    assert (result.token_usage.input_token, result.token_usage.output_token) == (1200, 800)
    assert result.token_usage.source == "provider_usage"


def test_slide_model_is_configurable(fake_cerebras, monkeypatch):
    monkeypatch.setenv("CEREBRAS_SLIDE_MODEL", "qwen-3.8-27b")
    fake_cerebras.result = completion(deck(5))

    generate_slide_deck_outline_with_usage(materials=MATERIALS, slide_count=5)

    assert fake_cerebras.calls[0]["model"] == "qwen-3.8-27b"


def test_outline_is_padded_or_trimmed_to_requested_count(fake_cerebras):
    fake_cerebras.result = completion(deck(2, bullets=9))

    outline = generate_slide_deck_outline_with_usage(materials=MATERIALS, slide_count=4).outline

    assert len(outline.slides) == 4
    assert len(outline.slides[0].bullets) == 6
    assert outline.slides[3].title == "Slide 4"


def test_truncated_output_is_reported(fake_cerebras):
    fake_cerebras.result = completion('{"title": "cut', finish_reason="length")

    with pytest.raises(SlideDeckServiceError, match="too long"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_unreadable_output_is_reported(fake_cerebras):
    fake_cerebras.result = completion("not json")

    with pytest.raises(SlideDeckServiceError, match="unreadable"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_bad_key_becomes_llm_service_error(fake_cerebras):
    fake_cerebras.error = status_error(401, "bad key")

    with pytest.raises(LLMServiceError, match="CEREBRAS_API_KEY"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_payment_required_is_explained(fake_cerebras):
    fake_cerebras.error = status_error(402, "Payment required to access this resource.")

    with pytest.raises(SlideDeckServiceError, match="billing"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_missing_key_is_reported(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "")

    with pytest.raises(MissingAPIKeyError, match="CEREBRAS_API_KEY"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)
