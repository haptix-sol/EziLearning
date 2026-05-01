"""Resolve the active :class:`~services.ai.protocol.LLMProvider` from settings."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import TYPE_CHECKING

from core.config import settings

if TYPE_CHECKING:
    from services.ai.protocol import LLMProvider

logger = logging.getLogger(__name__)


def _aws_credentials_available() -> bool:
    try:
        import boto3

        session = boto3.Session()
        creds = session.get_credentials()
        return creds is not None
    except Exception:
        return False


def _bedrock_region() -> str | None:
    for candidate in (
        (settings.bedrock_region or "").strip(),
        (settings.aws_region or "").strip(),
    ):
        if candidate:
            return candidate
    import os

    return (os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION") or "").strip() or None


def _bedrock_ready() -> bool:
    mid = (settings.bedrock_model_id or "").strip()
    region = _bedrock_region()
    return bool(mid and region)


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider | None:
    """Single cached provider for the process. Clear cache in tests via ``get_llm_provider.cache_clear()``."""
    from services.ai.bedrock_provider import BedrockConverseProvider
    from services.ai.openai_provider import OpenAIChatProvider

    mode = (settings.llm_provider or "auto").strip().lower()

    if mode == "openai":
        if settings.openai_api_key:
            logger.info("LLM provider: OpenAI (%s)", settings.openai_api_model)
            return OpenAIChatProvider(
                api_key=settings.openai_api_key,
                base_url=None,
                default_model=settings.openai_api_model,
                default_temperature=0.7,
                default_max_tokens=4096,
            )
        logger.warning("llm_provider=openai but OPENAI_API_KEY is not set")
        return None

    if mode in ("openai_compatible", "cursor_proxy"):
        compat_url = (settings.openai_compatible_base_url or settings.cursor_api_url or "").strip()
        compat_key = (settings.openai_compatible_api_key or settings.cursor_api_key or "").strip()
        compat_model = (settings.openai_compatible_model or settings.cursor_api_model or "gpt-4o-mini").strip()
        if compat_url:
            if settings.cursor_api_url and not settings.openai_compatible_base_url:
                logger.warning(
                    "CURSOR_API_URL is deprecated for production; prefer BEDROCK_MODEL_ID or OPENAI_COMPATIBLE_BASE_URL."
                )
            logger.info("LLM provider: OpenAI-compatible HTTP")
            return OpenAIChatProvider(
                api_key=compat_key or "empty",
                base_url=compat_url,
                default_model=compat_model,
                default_temperature=settings.cursor_api_model_temperature,
                default_max_tokens=settings.cursor_api_model_max_tokens,
            )
        logger.warning("llm_provider=%s but no compatible base URL is set", mode)
        return None

    if mode == "bedrock":
        if not _bedrock_ready():
            logger.warning("llm_provider=bedrock but bedrock_model_id or aws_region is missing")
            return None
        mid = (settings.bedrock_model_id or "").strip()
        region = _bedrock_region() or "us-east-1"
        logger.info("LLM provider: Bedrock (model_id=%s, region=%s)", mid, region)
        return BedrockConverseProvider(model_id=mid, region_name=region)

    # --- auto ---
    if _bedrock_ready() and _aws_credentials_available():
        mid = (settings.bedrock_model_id or "").strip()
        region = _bedrock_region() or "us-east-1"
        logger.info("LLM provider: Bedrock (auto, model_id=%s, region=%s)", mid, region)
        return BedrockConverseProvider(model_id=mid, region_name=region)

    if settings.openai_api_key:
        logger.info("LLM provider: OpenAI (auto, %s)", settings.openai_api_model)
        return OpenAIChatProvider(
            api_key=settings.openai_api_key,
            base_url=None,
            default_model=settings.openai_api_model,
            default_temperature=0.7,
            default_max_tokens=4096,
        )

    compat_url = (settings.openai_compatible_base_url or settings.cursor_api_url or "").strip()
    compat_key = (settings.openai_compatible_api_key or settings.cursor_api_key or "").strip()
    compat_model = (settings.openai_compatible_model or settings.cursor_api_model or "gpt-4o-mini").strip()
    if compat_url:
        logger.info("LLM provider: OpenAI-compatible HTTP (auto)")
        return OpenAIChatProvider(
            api_key=compat_key or "empty",
            base_url=compat_url,
            default_model=compat_model,
            default_temperature=settings.cursor_api_model_temperature,
            default_max_tokens=settings.cursor_api_model_max_tokens,
        )

    logger.warning(
        "No LLM provider configured. Set BEDROCK_MODEL_ID + AWS_REGION + credentials, "
        "or OPENAI_API_KEY, or OPENAI_COMPATIBLE_BASE_URL."
    )
    return None


def clear_llm_provider_cache() -> None:
    get_llm_provider.cache_clear()
