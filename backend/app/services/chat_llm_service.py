"""Project chat answers, generated with DeepSeek.

DeepSeek serves an OpenAI-compatible Chat Completions API, so this uses the ``openai``
SDK pointed at DeepSeek's base URL. Retrieval stays on Gemini embeddings
(``embedding_service``); only the answer written from the retrieved chunks comes from
DeepSeek.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import openai

from app.config import get_deepseek_api_key, get_deepseek_chat_model
from app.models.chat_model import ProjectChatMessageRecord
from app.models.quiz_model import QuizSourceMaterial
from app.services.llm_service import LLMServiceError, MissingAPIKeyError


DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MAX_CHAT_INPUT_CHARS = 24000
CHAT_HISTORY_LIMIT = 10
CHAT_TIMEOUT_SECONDS = 90.0

CHAT_INSTRUCTIONS = (
    "You are a curriculum assistant that answers only from the provided course documents.\n"
    "Use the documents as the source of truth. If the documents do not contain enough information, say that clearly and do not guess.\n"
    "Conversation history is provided only to understand follow-up references and user intent. "
    "Do not treat earlier assistant answers as factual evidence; resolve any conflict in favor of the documents.\n"
    "Prefer the source header when referring to sources. "
    "If a source header gives a page range such as pages 5-11, cite that full range exactly. "
    "Do not infer or mention a single exact page from within a page range. "
    "Never mention internal retrieval chunks.\n"
    "Keep the answer concise, direct, and helpful for a student or instructor.\n"
    # The chat panel shows text as-is, so Markdown would appear as literal ** and #.
    "Write plain text only: no Markdown such as **bold**, # headings, or tables. "
    "Use simple hyphen lists when a list helps."
)


class ChatServiceError(LLMServiceError):
    """Raised when DeepSeek fails to produce a usable chat answer."""


def answer_project_question(
    *,
    question: str,
    materials: list[QuizSourceMaterial],
    history: list[ProjectChatMessageRecord] | None = None,
) -> str:
    client, messages = _prepare_request(question=question, materials=materials, history=history)
    with _deepseek_errors():
        response = client.chat.completions.create(model=get_deepseek_chat_model(), messages=messages)

    choice = response.choices[0] if response.choices else None
    answer = (choice.message.content or "").strip() if choice else ""
    if not answer:
        raise ChatServiceError("DeepSeek returned an empty response.")

    return answer


def stream_project_answer(
    *,
    question: str,
    materials: list[QuizSourceMaterial],
    history: list[ProjectChatMessageRecord] | None = None,
) -> Iterator[str]:
    """Yield the answer's text as DeepSeek writes it.

    Validation and the request itself happen on the first ``next()``, so errors surface
    to whoever iterates. Reasoning tokens (``reasoning_content``) are never yielded.
    """
    client, messages = _prepare_request(question=question, materials=materials, history=history)
    with _deepseek_errors():
        stream = client.chat.completions.create(model=get_deepseek_chat_model(), messages=messages, stream=True)
        try:
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta is not None and delta.content:
                    yield delta.content
        finally:
            stream.close()


def _prepare_request(
    *,
    question: str,
    materials: list[QuizSourceMaterial],
    history: list[ProjectChatMessageRecord] | None,
) -> tuple[openai.OpenAI, list[dict[str, str]]]:
    api_key = get_deepseek_api_key()
    if not api_key:
        raise MissingAPIKeyError("DeepSeek API key not found. Set DEEPSEEK_API_KEY.")

    if not materials:
        raise ChatServiceError("At least one source material is required.")

    client = openai.OpenAI(
        api_key=api_key,
        base_url=DEEPSEEK_BASE_URL,
        timeout=CHAT_TIMEOUT_SECONDS,
        max_retries=3,
    )
    messages = [
        {"role": "system", "content": CHAT_INSTRUCTIONS},
        {"role": "user", "content": _build_chat_input(question=question, materials=materials, history=history or [])},
    ]
    return client, messages


@contextmanager
def _deepseek_errors() -> Iterator[None]:
    try:
        yield
    except openai.AuthenticationError as exc:
        raise ChatServiceError("DeepSeek rejected the API key. Check DEEPSEEK_API_KEY.") from exc
    except openai.APIStatusError as exc:
        if exc.status_code == 402:
            raise ChatServiceError("The DeepSeek account is out of credits, so chat is unavailable.") from exc
        raise ChatServiceError(f"DeepSeek request failed: {exc}") from exc
    except openai.APIError as exc:
        raise ChatServiceError(f"DeepSeek request failed: {exc}") from exc


def _build_chat_input(
    *,
    question: str,
    materials: list[QuizSourceMaterial],
    history: list[ProjectChatMessageRecord],
) -> str:
    source_blocks: list[str] = []
    remaining_chars = MAX_CHAT_INPUT_CHARS

    for material in materials:
        if remaining_chars <= 0:
            break

        clipped_text = material.text[:remaining_chars]
        remaining_chars -= len(clipped_text)
        source_blocks.append(
            "Source header: "
            f"{material.name}\n"
            "Citation rule: cite the source header location exactly as written; "
            "do not narrow a page range to a single page.\n"
            f"Text:\n{clipped_text}"
        )

    history_lines = [f"{message.role.upper()}: {message.content}" for message in history[-CHAT_HISTORY_LIMIT:]]
    joined_history = "\n".join(history_lines) if history_lines else "(No previous messages)"
    joined_sources = "\n\n".join(source_blocks)
    return (
        f"Conversation history (oldest to newest):\n{joined_history}\n\n"
        f"Current question:\n{question}\n\n"
        "Documents:\n"
        f"{joined_sources}"
    )
