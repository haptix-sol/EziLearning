"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.exceptions import AppException
from core.ffmpeg_paths import get_ffmpeg_executable, get_ffprobe_executable
from database import init_db

_logger = logging.getLogger(__name__)
from api.routers import resumes, challenges, questions, executions, progress, content, study, jobs, levels, gmail, onboarding, roadmap, videos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _logger.info(
        "FFmpeg: %s | ffprobe: %s",
        get_ffmpeg_executable(),
        get_ffprobe_executable(),
    )
    yield
    # cleanup if needed


app = FastAPI(
    title="EziLearning API",
    description="Interview preparation platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes.router)
app.include_router(challenges.router)
app.include_router(questions.router)
app.include_router(executions.router)
app.include_router(progress.router)
app.include_router(content.router)
app.include_router(study.router)
app.include_router(jobs.router)
app.include_router(levels.router)
app.include_router(gmail.router)
app.include_router(onboarding.router)
app.include_router(roadmap.router)
app.include_router(videos.router)

# Serve prerendered animations (binary-search.mp4, bubble-sort.mp4, etc.)
_animations_dir = Path(__file__).resolve().parent.parent / "static" / "animations"
if _animations_dir.exists():
    app.mount("/animations", StaticFiles(directory=str(_animations_dir)), name="animations")

# Serve user avatars
_avatars_dir = Path(settings.avatar_storage_path).resolve()
if not _avatars_dir.exists():
    _avatars_dir.mkdir(parents=True, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=str(_avatars_dir)), name="avatars")


@app.exception_handler(AppException)
def handle_app_exception(request, exc: AppException):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health")
def health():
    return {"status": "ok"}
