from __future__ import annotations

import json
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.models.quiz_model import QuizSourceMaterial
from app.services import slide_deck_llm_service
from app.services.llm_service import LLMServiceError, MissingAPIKeyError
from app.services.slide_deck_llm_service import ClaudeServiceError, generate_slide_deck_outline_with_usage


MATERIALS = [QuizSourceMaterial(id=1, name="Week 3 notes", text="Photosynthesis makes glucose from light.")]


def claude_message(payload, *, stop_reason: str = "end_turn"):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=1200, output_tokens=800),
    )


class FakeMessages:
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
def fake_claude(monkeypatch: pytest.MonkeyPatch) -> FakeMessages:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    messages = FakeMessages()
    monkeypatch.setattr(
        slide_deck_llm_service.anthropic,
        "Anthropic",
        lambda **kwargs: SimpleNamespace(beta=SimpleNamespace(messages=messages)),
    )
    return messages


def deck(slide_total: int, *, bullets: int = 3) -> dict:
    return {
        "title": "Photosynthesis",
        "subtitle": "How plants make food",
        "slides": [
            {"title": f"Slide {n}", "bullets": [f"Point {b}" for b in range(bullets)], "speaker_notes": "Note"}
            for n in range(slide_total)
        ],
    }


def test_outline_comes_from_claude_with_schema_and_fallback(fake_claude):
    fake_claude.result = claude_message(deck(3))

    result = generate_slide_deck_outline_with_usage(materials=MATERIALS, slide_count=3)

    call = fake_claude.calls[0]
    assert call["model"] == "claude-opus-5"
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "exactly 3 instructional slides" in call["messages"][0]["content"]
    assert "Source: Week 3 notes" in call["messages"][0]["content"]
    assert result.outline.title == "Photosynthesis"
    assert [slide.title for slide in result.outline.slides] == ["Slide 0", "Slide 1", "Slide 2"]
    assert (result.token_usage.input_token, result.token_usage.output_token) == (1200, 800)
    assert result.token_usage.source == "provider_usage"


def test_outline_is_padded_or_trimmed_to_requested_count(fake_claude):
    fake_claude.result = claude_message(deck(2, bullets=9))

    outline = generate_slide_deck_outline_with_usage(materials=MATERIALS, slide_count=4).outline

    assert len(outline.slides) == 4
    assert len(outline.slides[0].bullets) == 6
    assert outline.slides[3].title == "Slide 4"


def test_refusal_is_reported(fake_claude):
    fake_claude.result = claude_message("", stop_reason="refusal")

    with pytest.raises(ClaudeServiceError, match="declined"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_truncated_output_is_reported(fake_claude):
    fake_claude.result = claude_message('{"title": "cut', stop_reason="max_tokens")

    with pytest.raises(ClaudeServiceError, match="too long"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_bad_key_becomes_llm_service_error(fake_claude):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    fake_claude.error = anthropic.AuthenticationError(
        "bad key", response=httpx2.Response(401, request=request), body=None
    )

    with pytest.raises(LLMServiceError, match="ANTHROPIC_API_KEY"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_out_of_credit_is_explained(fake_claude):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    fake_claude.error = anthropic.BadRequestError(
        "Your credit balance is too low to access the Anthropic API.",
        response=httpx2.Response(400, request=request),
        body=None,
    )

    with pytest.raises(ClaudeServiceError, match="out of credits"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)


def test_missing_key_is_reported(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")

    with pytest.raises(MissingAPIKeyError, match="ANTHROPIC_API_KEY"):
        generate_slide_deck_outline_with_usage(materials=MATERIALS)
