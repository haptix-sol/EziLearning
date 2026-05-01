"""Amazon Bedrock Converse API (Qwen and other text models)."""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from core.config import settings
from services.ai.protocol import LLMProvider
from services.ai.types import LLMRequest, LLMResponse

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY_SEC = 1.5


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


class BedrockConverseProvider:
    """Bedrock ``converse`` — set ``bedrock_model_id`` to your Qwen (or other) model or inference profile ARN."""

    def __init__(self, *, model_id: str, region_name: str) -> None:
        self._model_id = model_id
        self._region = region_name
        self._client = boto3.client("bedrock-runtime", region_name=region_name)

    @property
    def name(self) -> str:
        return "bedrock"

    def _extract_text(self, output: dict[str, Any]) -> str:
        msg = output.get("message") or {}
        parts = msg.get("content") or []
        chunks: list[str] = []
        for block in parts:
            if isinstance(block, dict) and "text" in block:
                chunks.append(block["text"])
        return "\n".join(chunks).strip()

    def complete(self, request: LLMRequest) -> LLMResponse:
        user_text = request.user_content
        if request.response_format == "json_object":
            user_text = (
                request.user_content
                + "\n\nRespond with a single valid JSON object only. No markdown fences, no commentary."
            )

        body: dict[str, Any] = {
            "modelId": self._model_id,
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": user_text}],
                }
            ],
            "system": [{"text": request.system_prompt}],
            "inferenceConfig": {
                "maxTokens": min(request.max_tokens, 8192),
                "temperature": request.temperature,
            },
        }

        last_err: str | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = self._client.converse(**body)
                out = resp.get("output") or {}
                raw = self._extract_text(out)
                usage = resp.get("usage")
                usage_dict = dict(usage) if usage else None
                if not raw:
                    return LLMResponse(
                        raw_text="",
                        error=f"Empty Bedrock output (model={self._model_id!r})",
                        model_id=self._model_id,
                        usage=usage_dict,
                    )
                parsed = None
                if request.response_format == "json_object":
                    try:
                        parsed = _parse_json_response(raw)
                    except ValueError as e:
                        return LLMResponse(
                            raw_text=raw,
                            error=f"Model output was not valid JSON: {e}",
                            model_id=self._model_id,
                            usage=usage_dict,
                        )
                return LLMResponse(
                    raw_text=raw,
                    parsed_json=parsed,
                    model_id=self._model_id,
                    usage=usage_dict,
                )
            except ClientError as e:
                code = (e.response.get("Error") or {}).get("Code", "")
                last_err = f"Bedrock ClientError {code}: {e}"
                if code == "ValidationException" and "model identifier" in str(e).lower():
                    last_err = (
                        f"{last_err} "
                        f"Use the exact Model ID from Bedrock console (Playgrounds or Model catalog) for "
                        f"region {self._region!r} — e.g. Qwen3 on bedrock-runtime: qwen.qwen3-32b-v1:0. "
                        f"Current BEDROCK_MODEL_ID={self._model_id!r}. "
                        "Enable model access; older IDs like qwen.qwen2.5-* are often wrong or not Converse-enabled."
                    )
                if code in ("ThrottlingException", "TooManyRequestsException") and attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_DELAY_SEC * (attempt + 1))
                    continue
                logger.warning("%s", last_err)
                return LLMResponse(raw_text="", error=last_err, model_id=self._model_id)
            except BotoCoreError as e:
                last_err = f"Bedrock BotoCoreError: {e}"
                logger.exception(last_err)
                return LLMResponse(raw_text="", error=last_err, model_id=self._model_id)
            except Exception as e:
                last_err = f"Bedrock error: {e}"
                logger.exception(last_err)
                return LLMResponse(raw_text="", error=last_err, model_id=self._model_id)

        return LLMResponse(raw_text="", error=last_err or "Bedrock failed", model_id=self._model_id)
