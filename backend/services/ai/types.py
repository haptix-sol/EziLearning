"""Typed request/response for LLM providers."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class LLMRequest:
    """Single-turn chat-style request (system + user is the common case)."""

    system_prompt: str
    user_content: str
    temperature: float = 0.7
    max_tokens: int = 4096
    """When ``json_object``, provider should return parseable JSON (instruction + parsing)."""
    response_format: Literal["json_object", "text"] = "text"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResponse:
    raw_text: str
    parsed_json: dict[str, Any] | None = None
    error: str | None = None
    model_id: str | None = None
    usage: dict[str, Any] | None = None
