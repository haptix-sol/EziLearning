"""Application configuration."""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment."""

    # Database - PostgreSQL port 5433, database ezilearning
    # Set DATABASE_URL in .env: postgresql://user:password@host:5433/ezilearning
    database_url: str = "postgresql://user:password@localhost:5433/ezilearning"
    redis_url: str | None = None

    # LLM: OpenAI (preferred) or Cursor API
    openai_api_key: str | None = None
    openai_api_model: str = "gpt-4o-mini"
    # Optional: faster model for video generation
    openai_api_model_video: str | None = None

    cursor_api_key: str | None = None
    cursor_api_url: str | None = None  # e.g. proxy URL - api.cursor.com has no chat completions
    # Default when using CURSOR_API_URL + local proxy; use kimi-k2.5 (Moonshot) for cost-effective agentic tasks
    cursor_api_model: str = "kimi-k2.5"
    # Optional: faster model for video generation (segment map, storyboard text). Use gpt-4o-mini or similar.
    cursor_api_model_video: str | None = None
    cursor_api_model_temperature: float = 0.7
    cursor_api_model_max_tokens: int = 4096
    # LLM request timeout (seconds). Composer 1.5 can take 60–120s; increase if requests hang.
    llm_timeout: int = 120

    # Storage
    resume_storage_path: str = "./data/resumes"
    avatar_storage_path: str = "./data/avatars"
    videos_storage_path: str = "./data/videos"
    # Intermediate Varin (Rust) renders: default <varin-rust-root>/render (see core/varin_paths.py)
    varin_render_work_path: str | None = None
    # Path to ``varin`` / ``varin.exe`` (``cargo build --release``). Optional; default: <Varin>/target/release/
    varin_cli_path: str | None = None

    # FFmpeg / ffprobe: env FFMPEG_PATH, FFPROBE_PATH (optional overrides).
    # Default discovery: ../ffmpeg/bin/ next to backend (see repository ffmpeg/README.md).
    ffmpeg_path: str | None = None
    ffprobe_path: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Gmail OAuth - from Google Cloud Console
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure storage paths exist
Path(settings.resume_storage_path).mkdir(parents=True, exist_ok=True)
Path(settings.avatar_storage_path).mkdir(parents=True, exist_ok=True)
