"""LLM provider protocol."""
from __future__ import annotations

from typing import Protocol

from services.ai.types import LLMRequest, LLMResponse


class LLMProvider(Protocol):
    """Pluggable LLM backend (Bedrock, OpenAI, OpenAI-compatible HTTP, etc.)."""

    @property
    def name(self) -> str:
        """Short label for logs and health (e.g. ``bedrock``, ``openai``)."""

    def complete(self, request: LLMRequest) -> LLMResponse:
        """Run one completion. Implementations handle timeouts and retries internally."""
