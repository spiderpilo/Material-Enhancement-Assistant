import json
import re
from typing import Any
from uuid import uuid4

from google import genai

from app.config import DEFAULT_GEMINI_MODEL, get_gemini_api_key
from app.models.quiz_model import GeneratedQuiz, QuizOption, QuizQuestion, QuizSourceMaterial


MAX_INPUT_CHARS = 12000
MAX_QUIZ_INPUT_CHARS = 24000
QUIZ_OPTION_LABELS = ("A", "B", "C", "D")


class MissingAPIKeyError(Exception):
    """Raised when no Gemini API key is configured."""


class GeminiServiceError(Exception):
    """Raised when Gemini fails to produce a usable response."""


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
    return _normalize_quiz_payload(
        payload=payload,
        source_count=len(materials),
        question_count=question_count,
    )


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
            raise GeminiServiceError("Gemini returned malformed quiz JSON.") from exc

    if not isinstance(payload, dict):
        raise GeminiServiceError("Gemini quiz response must be a JSON object.")

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


def _read_required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)

    if not isinstance(value, str) or not value.strip():
        raise GeminiServiceError(f"Gemini quiz response is missing {key}.")

    return value.strip()
