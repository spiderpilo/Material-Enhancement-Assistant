"""Slide deck outlines, generated on Cerebras.

Cerebras serves an OpenAI-compatible Chat Completions API, so this uses the ``openai``
SDK pointed at Cerebras' base URL. Strict structured outputs constrain the reply to the
outline's JSON schema, so the response never needs fence-stripping or JSON repair;
``_normalize_slide_deck_payload`` still enforces the requested slide count and bullet
limits.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import openai

from app.config import get_cerebras_api_key, get_cerebras_slide_model
from app.models.quiz_model import QuizSourceMaterial
from app.models.slide_deck_model import SlideDeckOutline, SlideDeckOutlineSlide
from app.services.llm_service import LLMServiceError, MissingAPIKeyError
from app.utils.token_usage import TokenUsage


CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"
SLIDE_DECK_TIMEOUT_SECONDS = 180.0
MAX_SLIDE_INPUT_CHARS = 28000
MAX_BULLETS_PER_SLIDE = 6

SLIDE_DECK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "subtitle": {"type": "string"},
        "slides": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "bullets": {"type": "array", "items": {"type": "string"}},
                    "speaker_notes": {"type": "string"},
                },
                "required": ["title", "bullets", "speaker_notes"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "subtitle", "slides"],
    "additionalProperties": False,
}


class SlideDeckServiceError(LLMServiceError):
    """Raised when Cerebras fails to produce a usable slide deck outline."""


@dataclass(frozen=True)
class SlideDeckGenerationResult:
    outline: SlideDeckOutline
    token_usage: TokenUsage


def generate_slide_deck_outline_with_usage(
    *,
    materials: list[QuizSourceMaterial],
    slide_count: int = 10,
) -> SlideDeckGenerationResult:
    api_key = get_cerebras_api_key()
    if not api_key:
        raise MissingAPIKeyError("Cerebras API key not found. Set CEREBRAS_API_KEY.")

    if not materials:
        raise SlideDeckServiceError("At least one source material is required.")

    client = openai.OpenAI(
        api_key=api_key,
        base_url=CEREBRAS_BASE_URL,
        timeout=SLIDE_DECK_TIMEOUT_SECONDS,
        max_retries=3,
    )
    try:
        response = client.chat.completions.create(
            model=get_cerebras_slide_model(),
            messages=[{"role": "user", "content": _build_slide_deck_prompt(materials=materials, slide_count=slide_count)}],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "slide_deck", "strict": True, "schema": SLIDE_DECK_SCHEMA},
            },
        )
    except openai.AuthenticationError as exc:
        raise SlideDeckServiceError("Cerebras rejected the API key. Check CEREBRAS_API_KEY.") from exc
    except openai.APIStatusError as exc:
        if exc.status_code == 402:
            raise SlideDeckServiceError("The Cerebras account needs billing set up, so slide decks are unavailable.") from exc
        raise SlideDeckServiceError(f"Cerebras request failed: {exc}") from exc
    except openai.APIError as exc:
        raise SlideDeckServiceError(f"Cerebras request failed: {exc}") from exc

    choice = response.choices[0] if response.choices else None
    if choice is None:
        raise SlideDeckServiceError("Cerebras returned no slide deck.")
    if choice.finish_reason == "length":
        raise SlideDeckServiceError("The slide deck was too long to generate. Try fewer slides or sources.")

    try:
        payload = json.loads(choice.message.content or "")
    except json.JSONDecodeError as exc:
        raise SlideDeckServiceError("Cerebras returned an unreadable slide deck.") from exc
    if not isinstance(payload, dict):
        raise SlideDeckServiceError("Cerebras returned an unreadable slide deck.")

    usage = response.usage
    return SlideDeckGenerationResult(
        outline=_normalize_slide_deck_payload(payload=payload, slide_count=slide_count),
        token_usage=TokenUsage(
            input_token=usage.prompt_tokens if usage else None,
            output_token=usage.completion_tokens if usage else None,
            source="provider_usage" if usage else "estimated",
        ),
    )


def _build_slide_deck_prompt(
    *,
    materials: list[QuizSourceMaterial],
    slide_count: int,
) -> str:
    source_blocks: list[str] = []
    remaining_chars = MAX_SLIDE_INPUT_CHARS

    for material in materials:
        if remaining_chars <= 0:
            break

        clipped_text = material.text[:remaining_chars]
        remaining_chars -= len(clipped_text)
        source_blocks.append(f"Source: {material.name}\n{clipped_text}")

    joined_sources = "\n\n".join(source_blocks)
    return (
        "You are creating a lecture slide deck for instructors based only on provided course material.\n"
        f"Write an outline with a deck title, a short subtitle, and exactly {slide_count} instructional slides.\n"
        "Keep content accurate, concise, and student-facing.\n\n"
        "Rules:\n"
        "- 3 to 6 bullets per slide\n"
        "- each bullet should be one sentence fragment\n"
        "- one short presenter note per slide\n"
        "- prioritize concept explanation, examples, and checkpoints\n"
        "- no unsupported claims\n\n"
        "Source material:\n"
        f"{joined_sources}"
    )


def _normalize_slide_deck_payload(*, payload: dict[str, Any], slide_count: int) -> SlideDeckOutline:
    title_value = payload.get("title")
    subtitle_value = payload.get("subtitle")
    slides_value = payload.get("slides")

    title = title_value.strip() if isinstance(title_value, str) and title_value.strip() else "Generated Slide Deck"
    subtitle = subtitle_value.strip() if isinstance(subtitle_value, str) and subtitle_value.strip() else None

    slides: list[SlideDeckOutlineSlide] = []
    if isinstance(slides_value, list):
        for index, raw_slide in enumerate(slides_value[:slide_count]):
            if not isinstance(raw_slide, dict):
                continue

            raw_title = raw_slide.get("title")
            slide_title = raw_title.strip() if isinstance(raw_title, str) and raw_title.strip() else f"Slide {index + 1}"

            raw_bullets = raw_slide.get("bullets")
            bullets: list[str] = []
            if isinstance(raw_bullets, list):
                for bullet in raw_bullets:
                    if isinstance(bullet, str):
                        cleaned = bullet.strip()
                        if cleaned:
                            bullets.append(cleaned)

            if not bullets:
                bullets = ["Key concept summary unavailable."]

            notes_value = raw_slide.get("speaker_notes")
            notes = notes_value.strip() if isinstance(notes_value, str) else ""

            slides.append(
                SlideDeckOutlineSlide(
                    title=slide_title,
                    bullets=bullets[:MAX_BULLETS_PER_SLIDE],
                    speaker_notes=notes,
                )
            )

    while len(slides) < slide_count:
        slide_number = len(slides) + 1
        slides.append(
            SlideDeckOutlineSlide(
                title=f"Slide {slide_number}",
                bullets=["Add supporting content from the selected materials."],
                speaker_notes="",
            )
        )

    return SlideDeckOutline(
        title=title,
        subtitle=subtitle,
        slides=slides[:slide_count],
    )
