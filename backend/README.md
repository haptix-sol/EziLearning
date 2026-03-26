# EziLearning Backend (Python/FastAPI)

## Setup

```bash
cd backend
uv sync
```

This installs Python dependencies. **Video generation** uses the **Rust Varin** CLI bundled at `Varin/` (inside `backend/`). Build it once:

```bash
cd Varin
cargo build --release
```

The API looks for `Varin/target/release/varin` (or `varin.exe` on Windows). Override with **`VARIN_CLI_PATH`** in `.env` if needed.

## System dependencies (for video generation)

**FFmpeg** is required for merging video segments. It is NOT a Python package — install separately.

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

Copy `.env.example` to `.env` and set `DATABASE_URL` (PostgreSQL port 5433, database ezilearning) and your LLM keys.

**FFmpeg (video / audio):** With a local install under **`../ffmpeg/`** (repo root, see `../ffmpeg/README.md`), `.env.example` sets `FFMPEG_PATH=../ffmpeg/bin/ffmpeg.exe` on Windows. Optional: `FFPROBE_PATH` if `ffprobe` is not beside `ffmpeg`. Resolution logic: `core/ffmpeg_paths.py`. On startup the API logs the resolved `ffmpeg` and `ffprobe` paths.

**Varin improvement loop:** Renders append to `varin_render_events`. After `uv run ezilearning-migrate`, run `uv run ezilearning-varin-insights` (optional days: `uv run ezilearning-varin-insights 30`). See `docs/VARIN_IMPROVEMENT_LOOP.md`.

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
