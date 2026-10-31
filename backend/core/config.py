"""Application configuration."""
from pathlib import Path
from typing import Self
from urllib.parse import quote_plus

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings
from sqlalchemy.engine.url import make_url


class Settings(BaseSettings):
    """Application settings from environment."""

    # Database — prefer POSTGRES_* when the password has @, #, :, etc. (a single DATABASE_URL breaks).
    # Set DATABASE_URL in .env: postgresql://user:password@host:5433/ezilearning
    database_url: str = "postgresql://user:password@localhost:5433/ezilearning"
    postgres_host: str | None = None
    postgres_port: int = Field(default=5433, description="PostgreSQL port (repo default 5433).")
    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_db: str | None = None
    redis_url: str | None = None

    # LLM routing: auto | bedrock | openai | openai_compatible | cursor_proxy
    # auto: Bedrock if bedrock_model_id + region + AWS creds; else OpenAI key; else compatible URL.
    llm_provider: str = "auto"

    # Amazon Bedrock (Converse API) — default product path is Qwen on Bedrock
    # Region: BEDROCK_REGION wins over AWS_REGION / aws_region (Bedrock can differ from other AWS clients).
    bedrock_region: str | None = None
    aws_region: str | None = None  # general AWS; also used as Bedrock fallback if bedrock_region unset
    # Use the Model ID from the Bedrock console for your region (Converse on bedrock-runtime), e.g. qwen.qwen3-32b-v1:0
    bedrock_model_id: str | None = None

    # OpenAI official API
    openai_api_key: str | None = None
    openai_api_model: str = "gpt-4o-mini"

    # OpenAI-compatible HTTP (optional dev fallback — avoid for production)
    openai_compatible_base_url: str | None = None
    openai_compatible_api_key: str | None = None
    openai_compatible_model: str | None = None

    # Vercel service binding for internal cursor proxy service
    proxy_url: str | None = None

    # Deprecated: use openai_compatible_* ; kept for existing .env files
    cursor_api_key: str | None = None
    cursor_api_url: str | None = None
    cursor_api_model: str = "kimi-k2.5"
    cursor_api_model_temperature: float = 0.7
    cursor_api_model_max_tokens: int = 4096

    # LLM request timeout (seconds).
    llm_timeout: int = 120

    # Storage
    resume_storage_path: str = "./data/resumes"
    avatar_storage_path: str = "./data/avatars"
    # Expose filesystem paths in ``/health`` when True (do not enable in untrusted production).
    debug: bool = False

    # FFmpeg / ffprobe: env FFMPEG_PATH, FFPROBE_PATH (optional overrides).
    # Default discovery: ../ffmpeg/bin/ next to backend (see repository ffmpeg/README.md).
    ffmpeg_path: str | None = None
    ffprobe_path: str | None = None

    # CORS — browser treats localhost vs 127.0.0.1 as different origins; include both for Vite/React dev.
    # Override with JSON in .env if needed: CORS_ORIGINS='["https://app.example.com"]'
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

    # Gmail OAuth - from Google Cloud Console
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @model_validator(mode="after")
    def _assemble_and_validate_database_url(self) -> Self:
        if self.postgres_host:
            user = self.postgres_user or "postgres"
            db = self.postgres_db or "ezilearning"
            uq, pq = quote_plus(user), quote_plus(self.postgres_password or "")
            if self.postgres_password is not None and self.postgres_password != "":
                self.database_url = (
                    f"postgresql://{uq}:{pq}@{self.postgres_host}:{self.postgres_port}/{db}"
                )
            else:
                self.database_url = (
                    f"postgresql://{uq}@{self.postgres_host}:{self.postgres_port}/{db}"
                )
        try:
            url = make_url(self.database_url)
        except Exception as e:  # noqa: BLE001 — surface a clear config error
            raise ValueError(
                "Invalid DATABASE_URL. If the password contains @, #, or :, either set "
                "POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_DB "
                "in .env, or percent-encode the password in DATABASE_URL (@ → %40)."
            ) from e
        if (
            url.drivername.startswith("postgresql")
            and url.host is not None
            and "@" in str(url.host)
        ):
            raise ValueError(
                f"DATABASE_URL parses hostname {url.host!r}, which is invalid. "
                "An unescaped @ inside the password is the usual cause. "
                "Use POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_PORT / POSTGRES_DB "
                "in .env instead of a single URL, or encode @ as %40 in the password."
            )
        return self


settings = Settings()

# Ensure storage paths exist
Path(settings.resume_storage_path).mkdir(parents=True, exist_ok=True)
Path(settings.avatar_storage_path).mkdir(parents=True, exist_ok=True)
