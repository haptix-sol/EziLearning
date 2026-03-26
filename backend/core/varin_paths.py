"""Paths to the bundled **Rust Varin** engine under ``backend/Varin`` (or repo ``Varin Video Generator/Varin``).

Video rendering uses the ``varin`` CLI (``render-storyboard``), not ManimGL. Build the binary once:

  cd Varin   # e.g. backend/Varin
  cargo build --release

Override the executable with ``VARIN_CLI_PATH`` or ``settings.varin_cli_path``."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from core.config import settings

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent


def _env_varin_rust_root() -> Path | None:
    raw = os.environ.get("VARIN_RUST_ROOT", "").strip()
    if not raw:
        return None
    return Path(raw).resolve()


def get_varin_rust_root() -> Path:
    """Directory containing ``Cargo.toml`` for the Varin workspace."""
    env_root = _env_varin_rust_root()
    if env_root is not None:
        return env_root
    bundled = BACKEND_ROOT / "Varin"
    if bundled.is_dir() and (bundled / "Cargo.toml").is_file():
        return bundled.resolve()
    alt = REPO_ROOT / "Varin Video Generator" / "Varin"
    if alt.is_dir() and (alt / "Cargo.toml").is_file():
        return alt.resolve()
    legacy = REPO_ROOT / "Varin"
    if legacy.is_dir() and (legacy / "Cargo.toml").is_file():
        return legacy.resolve()
    return bundled.resolve()


def get_varin_render_work_root() -> Path:
    """Intermediate renders — default ``<varin-rust-root>/render``."""
    raw = getattr(settings, "varin_render_work_path", None) or ""
    s = str(raw).strip()
    if s:
        p = Path(s)
        if not p.is_absolute():
            p = (REPO_ROOT / p).resolve()
        return p
    return (get_varin_rust_root() / "render").resolve()


def get_varin_cli_executable() -> Path | None:
    """Path to ``varin`` / ``varin.exe`` (release build), or ``None`` if missing."""
    cfg = getattr(settings, "varin_cli_path", None) or ""
    if str(cfg).strip():
        p = Path(str(cfg).strip())
        if p.is_file():
            return p.resolve()
    env_p = os.environ.get("VARIN_CLI_PATH", "").strip()
    if env_p:
        p = Path(env_p)
        if p.is_file():
            return p.resolve()
    root = get_varin_rust_root()
    release = root / "target" / "release"
    if sys.platform == "win32":
        exe = release / "varin.exe"
        if exe.is_file():
            return exe.resolve()
    else:
        exe = release / "varin"
        if exe.is_file():
            return exe.resolve()
    return None
