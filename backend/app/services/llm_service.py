from google import genai

from app.config import DEFAULT_GEMINI_MODEL, get_gemini_api_key


MAX_INPUT_CHARS = 12000


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


def _build_prompt(text: str) -> str:
    return (
        "Improve the clarity of the academic material below for students.\n\n"
        "Return:\n"
        "1. A concise clearer rewrite.\n"
        "2. A brief note on what changed.\n\n"
        f"Material:\n{text}"
    )
