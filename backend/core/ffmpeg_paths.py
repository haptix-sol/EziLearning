"""Central FFmpeg / ffprobe resolution for the backend.

Priority:
1. ``FFMPEG_PATH`` / ``FFPROBE_PATH`` in environment (see ``core.config.Settings``)
2. Repository ``../ffmpeg/`` (sibling of ``backend/`` and ``frontend/``)
3. Legacy ``backend/ffmpeg/``
4. Windows winget Gyan.FFmpeg install path
5. ``PATH`` (``ffmpeg`` / ``ffprobe``)
6. Fallback command names ``ffmpeg`` / ``ffprobe`` (subprocess may fail if missing)
"""
from __future__ import annotations

import os
import shutil
from functools import lru_cache
from pathlib import Path

from core.config import settings

# backend/ directory (parent of core/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
# Repository root (parent of backend/)
REPO_ROOT = BACKEND_ROOT.parent


def _ffmpeg_candidates_under(root: Path) -> list[Path]:
    return [
        root / "ffmpeg" / "bin" / "ffmpeg.exe",
        root / "ffmpeg" / "ffmpeg.exe",
        root / "ffmpeg" / "ffmpeg-8.1-full_build" / "bin" / "ffmpeg.exe",
        root / "ffmpeg" / "ffmpeg-8.1" / "bin" / "ffmpeg.exe",
        root / "ffmpeg" / "bin" / "ffmpeg",
    ]


def _ffprobe_candidates_under(root: Path) -> list[Path]:
    return [
        root / "ffmpeg" / "bin" / "ffprobe.exe",
        root / "ffmpeg" / "ffprobe.exe",
        root / "ffmpeg" / "ffmpeg-8.1-full_build" / "bin" / "ffprobe.exe",
        root / "ffmpeg" / "ffmpeg-8.1" / "bin" / "ffprobe.exe",
        root / "ffmpeg" / "bin" / "ffprobe",
    ]


def _resolve_config_path(raw: str | None, *, backend_root: Path) -> str | None:
    if not raw:
        return None
    p = Path(raw)
    if p.is_absolute() and p.exists():
        return str(p)
    candidate = (backend_root / raw.lstrip("./")).resolve()
    if candidate.exists():
        return str(candidate)
    return None


def _winget_ffmpeg_candidates() -> list[Path]:
    out: list[Path] = []
    localappdata = os.environ.get("LOCALAPPDATA", "")
    if not localappdata:
        return out
    winget_packages = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
    if not winget_packages.exists():
        return out
    for pkg in winget_packages.glob("Gyan.FFmpeg*"):
        for sub in pkg.glob("ffmpeg-*-full_build"):
            exe = sub / "bin" / "ffmpeg.exe"
            if exe.exists():
                out.append(exe)
                break
        else:
            continue
        break
    return out


def _winget_ffprobe_candidates() -> list[Path]:
    out: list[Path] = []
    localappdata = os.environ.get("LOCALAPPDATA", "")
    if not localappdata:
        return out
    winget_packages = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
    if not winget_packages.exists():
        return out
    for pkg in winget_packages.glob("Gyan.FFmpeg*"):
        for sub in pkg.glob("ffmpeg-*-full_build"):
            exe = sub / "bin" / "ffprobe.exe"
            if exe.exists():
                out.append(exe)
                break
        else:
            continue
        break
    return out


def _companion_ffprobe(ffmpeg_bin: str) -> str | None:
    """If ``ffmpeg_bin`` is a concrete file path, return sibling ``ffprobe`` if it exists."""
    p = Path(ffmpeg_bin)
    if not p.is_file():
        return None
    parent = p.parent
    name = p.name.lower()
    if name == "ffmpeg.exe":
        probe = parent / "ffprobe.exe"
    elif name == "ffmpeg":
        probe = parent / "ffprobe"
    else:
        return None
    if probe.is_file():
        return str(probe)
    return None


@lru_cache(maxsize=1)
def get_ffmpeg_executable() -> str:
    """Resolved path or command name for the ``ffmpeg`` binary."""
    resolved = _resolve_config_path(settings.ffmpeg_path, backend_root=BACKEND_ROOT)
    if resolved:
        return resolved

    candidates: list[Path] = []
    candidates.extend(_ffmpeg_candidates_under(REPO_ROOT))
    candidates.extend(_ffmpeg_candidates_under(BACKEND_ROOT))
    candidates.extend(_winget_ffmpeg_candidates())

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    which = shutil.which("ffmpeg")
    if which:
        return which
    return "ffmpeg"


@lru_cache(maxsize=1)
def get_ffprobe_executable() -> str:
    """Resolved path or command name for the ``ffprobe`` binary."""
    resolved = _resolve_config_path(settings.ffprobe_path, backend_root=BACKEND_ROOT)
    if resolved:
        return resolved

    candidates: list[Path] = []
    candidates.extend(_ffprobe_candidates_under(REPO_ROOT))
    candidates.extend(_ffprobe_candidates_under(BACKEND_ROOT))
    candidates.extend(_winget_ffprobe_candidates())

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    companion = _companion_ffprobe(get_ffmpeg_executable())
    if companion:
        return companion

    which = shutil.which("ffprobe")
    if which:
        return which
    return "ffprobe"


def invalidate_ffmpeg_cache() -> None:
    """Clear resolution cache (e.g. in tests after env change)."""
    get_ffmpeg_executable.cache_clear()
    get_ffprobe_executable.cache_clear()
