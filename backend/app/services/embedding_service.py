from dataclasses import dataclass

from google import genai
from google.genai import types

from app.config import (
    get_gemini_api_key,
    get_gemini_embedding_dimensions,
    get_gemini_embedding_model,
)


DEFAULT_CHUNK_SIZE = 1800
DEFAULT_CHUNK_OVERLAP = 250


class MissingGeminiAPIKeyError(Exception):
    """Raised when no Gemini API key is configured."""


class GeminiEmbeddingError(Exception):
    """Raised when Gemini fails to create embeddings."""


@dataclass(frozen=True)
class TextChunk:
    index: int
    text: str
    start_char: int
    end_char: int


@dataclass(frozen=True)
class EmbeddedTextChunk:
    chunk: TextChunk
    embedding: list[float]


def chunk_text(
    text: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[TextChunk]:
    normalized_text = " ".join(text.split())
    if not normalized_text:
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive.")
    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be non-negative and smaller than chunk_size.")

    chunks: list[TextChunk] = []
    start = 0
    text_length = len(normalized_text)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end < text_length:
            boundary = normalized_text.rfind(" ", start, end)
            minimum_boundary = start + max(1, chunk_size // 2)
            if boundary >= minimum_boundary:
                end = boundary

        chunk_body = normalized_text[start:end].strip()
        if chunk_body:
            chunks.append(
                TextChunk(
                    index=len(chunks),
                    text=chunk_body,
                    start_char=start,
                    end_char=end,
                )
            )

        if end >= text_length:
            break

        start = max(end - chunk_overlap, start + 1)

    return chunks


def embed_text(text: str) -> list[float]:
    embeddings = embed_texts([text])
    return embeddings[0] if embeddings else []


def embed_texts(texts: list[str]) -> list[list[float]]:
    api_key = get_gemini_api_key()
    if not api_key:
        raise MissingGeminiAPIKeyError(
            "Gemini API key not found. Set GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY."
        )

    normalized_texts = [text.strip() for text in texts if text and text.strip()]
    if not normalized_texts:
        return []

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.embed_content(
            model=get_gemini_embedding_model(),
            contents=normalized_texts,
            config=types.EmbedContentConfig(
                output_dimensionality=get_gemini_embedding_dimensions(),
            ),
        )
    except Exception as exc:
        raise GeminiEmbeddingError(f"Gemini embedding request failed: {exc}") from exc

    response_embeddings = response.embeddings or []
    if len(response_embeddings) != len(normalized_texts):
        raise GeminiEmbeddingError("Gemini returned an incomplete embedding response.")

    embeddings: list[list[float]] = []
    for response_embedding in response_embeddings:
        values = response_embedding.values
        if not values:
            raise GeminiEmbeddingError("Gemini returned an empty embedding.")
        embeddings.append(list(values))

    return embeddings


def embed_chunks(chunks: list[TextChunk]) -> list[EmbeddedTextChunk]:
    embeddings = embed_texts([chunk.text for chunk in chunks])
    return [
        EmbeddedTextChunk(chunk=chunk, embedding=embedding)
        for chunk, embedding in zip(chunks, embeddings)
    ]
