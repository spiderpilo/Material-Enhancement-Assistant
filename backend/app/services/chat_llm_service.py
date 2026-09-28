"""Project chat answers, generated with OpenAI (Responses API).

Retrieval stays on Gemini embeddings (``embedding_service``); only the answer that is
written from the retrieved chunks comes from OpenAI.
"""

from __future__ import annotations

import openai

from app.config import get_openai_api_key, get_openai_chat_model
from app.models.chat_model import ProjectChatMessageRecord
from app.models.quiz_model import QuizSourceMaterial
from app.services.llm_service import LLMServiceError, MissingAPIKeyError


MAX_CHAT_INPUT_CHARS = 24000
CHAT_HISTORY_LIMIT = 10
CHAT_TIMEOUT_SECONDS = 90.0
# 429 codes for an exhausted balance; retrying them never helps.
OUT_OF_CREDIT_CODES = {"insufficient_quota", "credit_balance_exhausted"}

CHAT_INSTRUCTIONS = (
    "You are a curriculum assistant that answers only from the provided course documents.\n"
    "Use the documents as the source of truth. If the documents do not contain enough information, say that clearly and do not guess.\n"
    "Conversation history is provided only to understand follow-up references and user intent. "
    "Do not treat earlier assistant answers as factual evidence; resolve any conflict in favor of the documents.\n"
    "Prefer the source header when referring to sources. "
    "If a source header gives a page range such as pages 5-11, cite that full range exactly. "
    "Do not infer or mention a single exact page from within a page range. "
    "Never mention internal retrieval chunks.\n"
    "Keep the answer concise, direct, and helpful for a student or instructor."
)


class OpenAIServiceError(LLMServiceError):
    """Raised when OpenAI fails to produce a usable chat answer."""


def answer_project_question(
    *,
    question: str,
    materials: list[QuizSourceMaterial],
    history: list[ProjectChatMessageRecord] | None = None,
) -> str:
    api_key = get_openai_api_key()
    if not api_key:
        raise MissingAPIKeyError("OpenAI API key not found. Set OPENAI_API_KEY.")

    if not materials:
        raise OpenAIServiceError("At least one source material is required.")

    client = openai.OpenAI(api_key=api_key, timeout=CHAT_TIMEOUT_SECONDS, max_retries=3)
    try:
        response = client.responses.create(
            model=get_openai_chat_model(),
            instructions=CHAT_INSTRUCTIONS,
            input=_build_chat_input(question=question, materials=materials, history=history or []),
        )
    except openai.AuthenticationError as exc:
        raise OpenAIServiceError("OpenAI rejected the API key. Check OPENAI_API_KEY.") from exc
    except openai.RateLimitError as exc:
        if exc.code in OUT_OF_CREDIT_CODES:
            raise OpenAIServiceError("The OpenAI account is out of credits, so chat is unavailable.") from exc
        raise OpenAIServiceError("OpenAI is rate limiting chat requests. Try again shortly.") from exc
    except openai.APIError as exc:
        raise OpenAIServiceError(f"OpenAI request failed: {exc}") from exc

    answer = (response.output_text or "").strip()
    if not answer:
        raise OpenAIServiceError("OpenAI returned an empty response.")

    return answer


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
