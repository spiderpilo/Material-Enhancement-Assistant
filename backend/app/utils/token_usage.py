import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TokenUsage:
    input_token: int | None
    output_token: int | None
    source: str


def extract_token_usage(
    *,
    response: Any,
    prompt: str,
    response_text: str,
) -> TokenUsage:
    usage_metadata = getattr(response, "usage_metadata", None)

    input_token: int | None = None
    output_token: int | None = None
    source = "estimated"

    if usage_metadata is not None:
        input_token = _read_token_value(
            usage_metadata,
            ("prompt_token_count", "input_token_count", "prompt_tokens"),
        )
        output_token = _read_token_value(
            usage_metadata,
            (
                "candidates_token_count",
                "output_token_count",
                "response_token_count",
                "completion_token_count",
                "output_tokens",
            ),
        )
        if input_token is not None or output_token is not None:
            source = "provider_usage"

    estimated_input = _estimate_token_count(prompt)
    estimated_output = _estimate_token_count(response_text)

    if input_token is None:
        input_token = estimated_input
        if source == "provider_usage":
            source = "provider_usage_plus_estimate"

    if output_token is None:
        output_token = estimated_output
        if source == "provider_usage":
            source = "provider_usage_plus_estimate"

    return TokenUsage(
        input_token=input_token,
        output_token=output_token,
        source=source,
    )


def _read_token_value(usage_metadata: Any, candidate_keys: tuple[str, ...]) -> int | None:
    for key in candidate_keys:
        value: Any = None

        if isinstance(usage_metadata, dict):
            value = usage_metadata.get(key)
        else:
            value = getattr(usage_metadata, key, None)
            if value is None and hasattr(usage_metadata, "to_dict"):
                try:
                    metadata_dict = usage_metadata.to_dict()
                    if isinstance(metadata_dict, dict):
                        value = metadata_dict.get(key)
                except Exception:
                    value = None

        if isinstance(value, int):
            return value

    return None


def _estimate_token_count(text: str) -> int:
    if not text:
        return 0

    return max(1, math.ceil(len(text) / 4))
