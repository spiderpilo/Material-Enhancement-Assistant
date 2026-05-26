import json
import re
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from google import genai

from app.config import DEFAULT_GEMINI_MODEL, get_gemini_api_key
from app.models.quiz_model import GeneratedQuiz, QuizOption, QuizQuestion, QuizSourceMaterial
from app.models.slide_deck_model import SlideDeckOutline, SlideDeckOutlineSlide
from app.utils.token_usage import TokenUsage, extract_token_usage


MAX_INPUT_CHARS = 12000
MAX_QUIZ_INPUT_CHARS = 24000
MAX_SLIDE_INPUT_CHARS = 28000
QUIZ_OPTION_LABELS = ("A", "B", "C", "D")


class MissingAPIKeyError(Exception):
    """Raised when no Gemini API key is configured."""


class GeminiServiceError(Exception):
    """Raised when Gemini fails to produce a usable response."""


@dataclass(frozen=True)
class QuizGenerationResult:
    quiz: GeneratedQuiz
    token_usage: TokenUsage


@dataclass(frozen=True)
class SlideDeckGenerationResult:
    outline: SlideDeckOutline
    token_usage: TokenUsage


def improve_clarity(text: str) -> str:
    api_key = get_gemini_api_key()
    if not api_key:
        raise MissingAPIKeyError(
            "Gemini API key not found. Set GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY."
        )

    prompt = _build_prompt(text[:MAX_INPUT_CHARS])
    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=prompt,
        )
    except Exception as exc:
        raise GeminiServiceError(f"Gemini request failed: {exc}") from exc

    try:
        response_text = response.text
    except Exception as exc:
        raise GeminiServiceError(f"Gemini returned an unreadable response: {exc}") from exc

    if not response_text or not response_text.strip():
        raise GeminiServiceError("Gemini returned an empty response.")

    return response_text.strip()


def generate_quiz(
    *,
    materials: list[QuizSourceMaterial],
    question_count: int = 12,
) -> GeneratedQuiz:
    return generate_quiz_with_usage(
        materials=materials,
        question_count=question_count,
    ).quiz


def generate_quiz_with_usage(
    *,
    materials: list[QuizSourceMaterial],
    question_count: int = 12,
) -> QuizGenerationResult:
    api_key = get_gemini_api_key()
    if not api_key:
        raise MissingAPIKeyError(
            "Gemini API key not found. Set GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY."
        )

    if not materials:
        raise GeminiServiceError("At least one source material is required.")

    prompt = _build_quiz_prompt(materials=materials, question_count=question_count)
    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=prompt,
        )
    except Exception as exc:
        raise GeminiServiceError(f"Gemini request failed: {exc}") from exc

    try:
        response_text = response.text
    except Exception as exc:
        raise GeminiServiceError(f"Gemini returned an unreadable response: {exc}") from exc

    if not response_text or not response_text.strip():
        raise GeminiServiceError("Gemini returned an empty response.")

    payload = _parse_json_object(response_text)
    quiz = _normalize_quiz_payload(
        payload=payload,
        source_count=len(materials),
        question_count=question_count,
    )
    token_usage = extract_token_usage(
        response=response,
        prompt=prompt,
        response_text=response_text,
    )

    return QuizGenerationResult(quiz=quiz, token_usage=token_usage)


def generate_slide_deck_outline_with_usage(
    *,
    materials: list[QuizSourceMaterial],
    slide_count: int = 10,
) -> SlideDeckGenerationResult:
    api_key = get_gemini_api_key()
    if not api_key:
        raise MissingAPIKeyError(
            "Gemini API key not found. Set GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY."
        )

    if not materials:
        raise GeminiServiceError("At least one source material is required.")

    prompt = _build_slide_deck_prompt(materials=materials, slide_count=slide_count)
    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=prompt,
        )
    except Exception as exc:
        raise GeminiServiceError(f"Gemini request failed: {exc}") from exc

    try:
        response_text = response.text
    except Exception as exc:
        raise GeminiServiceError(f"Gemini returned an unreadable response: {exc}") from exc

    if not response_text or not response_text.strip():
        raise GeminiServiceError("Gemini returned an empty response.")

    payload = _parse_json_object(response_text)
    outline = _normalize_slide_deck_payload(payload=payload, slide_count=slide_count)
    token_usage = extract_token_usage(
        response=response,
        prompt=prompt,
        response_text=response_text,
    )

    return SlideDeckGenerationResult(outline=outline, token_usage=token_usage)


def _build_prompt(text: str) -> str:
    return (
        "Improve the clarity of the academic material below for students.\n\n"
        "Return:\n"
        "1. A concise clearer rewrite.\n"
        "2. A brief note on what changed.\n\n"
        f"Material:\n{text}"
    )


def _build_quiz_prompt(
    *,
    materials: list[QuizSourceMaterial],
    question_count: int,
) -> str:
    source_blocks: list[str] = []
    remaining_chars = MAX_QUIZ_INPUT_CHARS

    for material in materials:
        if remaining_chars <= 0:
            break

        clipped_text = material.text[:remaining_chars]
        remaining_chars -= len(clipped_text)
        source_blocks.append(
            f"Source: {material.name}\n{clipped_text}"
        )

    return (
        "Create a student practice quiz from the academic source material below.\n"
        f"Return exactly {question_count} multiple-choice questions.\n"
        "Use only facts supported by the source material.\n"
        "Each question must have exactly four options labeled A, B, C, and D.\n"
        "Include a short explanation for every option and a short overall explanation.\n"
        "Return only valid JSON. Do not use markdown fences.\n\n"
        "JSON shape:\n"
        "{\n"
        '  "title": "Short quiz title",\n'
        '  "questions": [\n'
        "    {\n"
        '      "prompt": "Question text",\n'
        '      "options": [\n'
        '        {"label": "A", "text": "Option text", "explanation": "Why this option is right or wrong"},\n'
        '        {"label": "B", "text": "Option text", "explanation": "Why this option is right or wrong"},\n'
        '        {"label": "C", "text": "Option text", "explanation": "Why this option is right or wrong"},\n'
        '        {"label": "D", "text": "Option text", "explanation": "Why this option is right or wrong"}\n'
        "      ],\n"
        '      "correct_label": "A",\n'
        '      "explanation": "Why the correct answer is correct"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Source material:\n"
        f"{'\n\n'.join(source_blocks)}"
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

    return (
        "You are creating a lecture slide deck for instructors based only on provided course material.\n"
        f"Return a JSON slide outline with exactly {slide_count} instructional slides.\n"
        "Keep content accurate, concise, and student-facing.\n"
        "Do not include markdown fences or commentary. Return valid JSON only.\n\n"
        "JSON shape:\n"
        "{\n"
        '  "title": "Deck title",\n'
        '  "subtitle": "Optional subtitle",\n'
        '  "slides": [\n'
        "    {\n"
        '      "title": "Slide title",\n'
        '      "bullets": ["bullet 1", "bullet 2", "bullet 3"],\n'
        '      "speaker_notes": "One short presenter note"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- 3 to 6 bullets per slide\n"
        "- each bullet should be one sentence fragment\n"
        "- prioritize concept explanation, examples, and checkpoints\n"
        "- no unsupported claims\n\n"
        "Source material:\n"
        f"{'\n\n'.join(source_blocks)}"
    )


def _parse_json_object(response_text: str) -> dict[str, Any]:
    trimmed_text = response_text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", trimmed_text, flags=re.DOTALL)
    if fence_match:
        trimmed_text = fence_match.group(1).strip()

    try:
        payload = json.loads(trimmed_text)
    except json.JSONDecodeError:
        object_match = re.search(r"\{.*\}", trimmed_text, flags=re.DOTALL)
        if not object_match:
            raise GeminiServiceError("Gemini did not return a JSON object.")

        try:
            payload = json.loads(object_match.group(0))
        except json.JSONDecodeError as exc:
            raise GeminiServiceError("Gemini returned malformed JSON.") from exc

    if not isinstance(payload, dict):
        raise GeminiServiceError("Gemini response must be a JSON object.")

    return payload


def _normalize_quiz_payload(
    *,
    payload: dict[str, Any],
    source_count: int,
    question_count: int,
) -> GeneratedQuiz:
    title = payload.get("title")
    questions_payload = payload.get("questions")

    if not isinstance(title, str) or not title.strip():
        title = "Generated Quiz"

    if not isinstance(questions_payload, list) or len(questions_payload) != question_count:
        raise GeminiServiceError(f"Gemini must return exactly {question_count} questions.")

    questions: list[QuizQuestion] = []

    for question_index, question_payload in enumerate(questions_payload):
        if not isinstance(question_payload, dict):
            raise GeminiServiceError("Gemini returned an invalid question item.")

        prompt = _read_required_string(question_payload, "prompt")
        options_payload = question_payload.get("options")
        correct_label = _read_required_string(question_payload, "correct_label").upper()
        explanation = _read_required_string(question_payload, "explanation")

        if correct_label not in QUIZ_OPTION_LABELS:
            raise GeminiServiceError("Gemini returned an invalid correct option label.")

        if not isinstance(options_payload, list) or len(options_payload) != 4:
            raise GeminiServiceError("Each quiz question must include four options.")

        options_by_label: dict[str, QuizOption] = {}
        question_id = f"question-{question_index + 1}"

        for option_payload in options_payload:
            if not isinstance(option_payload, dict):
                raise GeminiServiceError("Gemini returned an invalid option item.")

            label = _read_required_string(option_payload, "label").upper()
            if label not in QUIZ_OPTION_LABELS:
                raise GeminiServiceError("Gemini returned an invalid option label.")
            if label in options_by_label:
                raise GeminiServiceError("Gemini returned duplicate option labels.")

            options_by_label[label] = QuizOption(
                id=f"{question_id}-{label.lower()}",
                label=label,
                text=_read_required_string(option_payload, "text"),
                explanation=_read_required_string(option_payload, "explanation"),
            )

        if set(options_by_label) != set(QUIZ_OPTION_LABELS):
            raise GeminiServiceError("Gemini must return options A, B, C, and D.")

        questions.append(
            QuizQuestion(
                id=question_id,
                prompt=prompt,
                options=[options_by_label[label] for label in QUIZ_OPTION_LABELS],
                correct_option_id=f"{question_id}-{correct_label.lower()}",
                explanation=explanation,
            )
        )

    return GeneratedQuiz(
        quiz_id=f"quiz-{uuid4()}",
        title=title.strip(),
        source_count=source_count,
        questions=questions,
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
                    bullets=bullets[:6],
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


def _read_required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)

    if not isinstance(value, str) or not value.strip():
        raise GeminiServiceError(f"Gemini quiz response is missing {key}.")

    return value.strip()
