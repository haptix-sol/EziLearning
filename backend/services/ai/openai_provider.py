"""OpenAI SDK: official API or OpenAI-compatible base URL (chat completions)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from core.config import settings
from services.ai.protocol import LLMProvider
from services.ai.types import LLMRequest, LLMResponse

logger = logging.getLogger(__name__)


def _parse_json_response(content: str) -> dict[str, Any]:
    text = (content or "").strip()
    if not text:
        raise ValueError("empty model content")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        inner = m.group(1).strip()
        if inner:
            try:
                return json.loads(inner)
            except json.JSONDecodeError:
                pass
    start = text.find("{")
    if start != -1:
        try:
            obj, _end = json.JSONDecoder().raw_decode(text[start:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    raise ValueError(f"not valid JSON (len={len(text)}, preview={text[:200]!r})")


class OpenAIChatProvider:
    """Chat completions via OpenAI SDK (api.openai.com or custom ``base_url``)."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None,
        default_model: str,
        default_temperature: float = 0.7,
        default_max_tokens: int = 4096,
    ) -> None:
        from openai import OpenAI

        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            u = base_url.rstrip("/")
            if not u.endswith("/v1"):
                u = u + "/v1"
            kwargs["base_url"] = u
        self._client = OpenAI(**kwargs)
        self._default_model = default_model
        self._default_temperature = default_temperature
        self._default_max_tokens = default_max_tokens
        self._name = "openai" if not base_url else "openai_compatible"

    @property
    def name(self) -> str:
        return self._name

    def complete(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or self._default_model
        temp = request.temperature if request.temperature is not None else self._default_temperature
        max_t = request.metadata.get("max_tokens") or self._default_max_tokens
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": [
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.user_content},
                ],
                "temperature": temp,
                "max_tokens": max_t,
                "timeout": settings.llm_timeout,
            }
            if request.response_format == "json_object":
                kwargs["response_format"] = {"type": "json_object"}

            response = self._client.chat.completions.create(**kwargs)
            raw = (response.choices[0].message.content or "").strip()
            usage = None
            if getattr(response, "usage", None):
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                }
            if not raw:
                return LLMResponse(
                    raw_text="",
                    error=f"Empty response from model {model!r}",
                    model_id=model,
                    usage=usage,
                )
            parsed = None
            if request.response_format == "json_object":
                try:
                    parsed = _parse_json_response(raw)
                except ValueError as e:
                    return LLMResponse(
                        raw_text=raw,
                        error=f"Model output was not valid JSON: {e}",
                        model_id=model,
                        usage=usage,
                    )
            return LLMResponse(raw_text=raw, parsed_json=parsed, model_id=model, usage=usage)
        except Exception as e:
            logger.exception("OpenAI-compatible LLM call failed: %s", e)
            return LLMResponse(raw_text="", error=f"LLM request failed: {e}", model_id=model)
