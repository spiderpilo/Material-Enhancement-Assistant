"""Slide deck outlines, generated with Claude.

Structured outputs constrain the reply to the outline's JSON schema, so the response
never needs fence-stripping or JSON repair; ``_normalize_slide_deck_payload`` still
enforces the requested slide count and bullet limits.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import anthropic

from app.config import get_anthropic_api_key
from app.models.quiz_model import QuizSourceMaterial
from app.models.slide_deck_model import SlideDeckOutline, SlideDeckOutlineSlide
from app.services.llm_service import LLMServiceError, MissingAPIKeyError
from app.utils.token_usage import TokenUsage


SLIDE_DECK_MODEL = "claude-opus-5"
SLIDE_DECK_MAX_TOKENS = 16000
SLIDE_DECK_TIMEOUT_SECONDS = 300.0
MAX_SLIDE_INPUT_CHARS = 28000
MAX_BULLETS_PER_SLIDE = 6
# Re-runs a request Claude's safety classifiers decline on Anthropic's recommended
# fallback model, inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

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


class ClaudeServiceError(LLMServiceError):
    """Raised when Claude fails to produce a usable slide deck outline."""


@dataclass(frozen=True)
class SlideDeckGenerationResult:
    outline: SlideDeckOutline
    token_usage: TokenUsage


def generate_slide_deck_outline_with_usage(
    *,
    materials: list[QuizSourceMaterial],
    slide_count: int = 10,
) -> SlideDeckGenerationResult:
    api_key = get_anthropic_api_key()
    if not api_key:
        raise MissingAPIKeyError("Anthropic API key not found. Set ANTHROPIC_API_KEY.")

    if not materials:
        raise ClaudeServiceError("At least one source material is required.")

    client = anthropic.Anthropic(api_key=api_key, timeout=SLIDE_DECK_TIMEOUT_SECONDS, max_retries=3)
    try:
        response = client.beta.messages.create(
            model=SLIDE_DECK_MODEL,
            max_tokens=SLIDE_DECK_MAX_TOKENS,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"format": {"type": "json_schema", "schema": SLIDE_DECK_SCHEMA}},
            messages=[{"role": "user", "content": _build_slide_deck_prompt(materials=materials, slide_count=slide_count)}],
        )
    except anthropic.AuthenticationError as exc:
        raise ClaudeServiceError("Anthropic rejected the API key. Check ANTHROPIC_API_KEY.") from exc
    except anthropic.BadRequestError as exc:
        # An empty balance is reported as a 400, not a 402/429.
        if "credit balance" in exc.message.lower():
            raise ClaudeServiceError("The Anthropic account is out of credits, so slide decks are unavailable.") from exc
        raise ClaudeServiceError(f"Claude request failed: {exc}") from exc
    except anthropic.APIError as exc:
        raise ClaudeServiceError(f"Claude request failed: {exc}") from exc

    if response.stop_reason == "refusal":
        raise ClaudeServiceError("Claude declined to build a slide deck from these materials.")
    if response.stop_reason == "max_tokens":
        raise ClaudeServiceError("The slide deck was too long to generate. Try fewer slides or sources.")

    response_text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise ClaudeServiceError("Claude returned an unreadable slide deck.") from exc

    return SlideDeckGenerationResult(
        outline=_normalize_slide_deck_payload(payload=payload, slide_count=slide_count),
        token_usage=TokenUsage(
            input_token=response.usage.input_tokens,
            output_token=response.usage.output_tokens,
            source="provider_usage",
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
