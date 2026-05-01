# EziLearning Backend (Python/FastAPI)

## Setup

```bash
cd backend
uv sync
```

This installs Python dependencies.

## System dependencies (optional tooling)

**FFmpeg** is optional unless you add features that shell out to it. It is not a Python package — install separately if needed.

**Recommended (project-local):** extract a Windows build into **`ffmpeg/` at the repository root** (next to `backend/` and `frontend/`) so you have `ffmpeg/bin/ffmpeg.exe`. See **`../ffmpeg/README.md`**.

Alternatively:

```bash
# Windows (PowerShell)
winget install FFmpeg

# Or run the install script
.\scripts\install_ffmpeg.ps1
```

```bash
# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

Then run `uv sync` to install Python deps:

```bash
uv sync
```

## Configure

Copy `.env.example` to `.env` and set `DATABASE_URL`, or use `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `POSTGRES_DB` when the password contains `@` or other characters that break a single URL (default port in examples is 5433, database `ezilearning`).

**LLM:** All generation goes through [services/ai/](services/ai/) with **`LLM_PROVIDER=auto`** by default: **Bedrock** if `BEDROCK_MODEL_ID` + region (`BEDROCK_REGION`, or `AWS_DEFAULT_REGION` / `AWS_REGION` / `aws_region`) and AWS credentials are available; else **OpenAI** if `OPENAI_API_KEY` is set; else an **OpenAI-compatible** base URL. For Bedrock, set **`BEDROCK_MODEL_ID` to the exact Model ID** from the console for that region (wrong IDs cause `ValidationException: invalid model identifier`). A common Qwen3 Converse ID is `qwen.qwen3-32b-v1:0` where the model is offered. Set `LLM_PROVIDER=bedrock` to force Bedrock when multiple options exist.

**FFmpeg:** With a local install under **`../ffmpeg/`** (repo root, see `../ffmpeg/README.md`), `.env.example` sets `FFMPEG_PATH=../ffmpeg/bin/ffmpeg.exe` on Windows. Optional: `FFPROBE_PATH` if `ffprobe` is not beside `ffmpeg`. Resolution logic: `core/ffmpeg_paths.py`. On startup the API logs the resolved `ffmpeg` and `ffprobe` paths.

## Manim (optional — local experiments only)

Manim lives entirely under **[`manim/`](manim/)** (separate uv project + venv). See **[`manim/README.md`](manim/README.md)** for install and layout. It is **not** imported by the FastAPI app.

## Database migration

Run migrations to create tables and add new columns:

```bash
uv run ezilearning-migrate
```

## Run

```bash
# Seed database (first time)
uv run ezilearning-seed

# Start API (pick one)
uv run python main.py 8000
# or
uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
