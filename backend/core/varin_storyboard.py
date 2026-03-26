"""Build Varin storyboard JSON and invoke the Rust ``varin render-storyboard`` CLI."""
from __future__ import annotations

import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Any

from core.varin_paths import get_varin_cli_executable, get_varin_rust_root

logger = logging.getLogger(__name__)

# Must match ``education_presets.json`` count (see Varin ``scripts/generate_education_presets.py``).
EDU_PRESET_COUNT = 250


def _edu_preset_index(topic: str, segment_index: int) -> int:
    """Stable index 0..EDU_PRESET_COUNT-1 so each segment gets a varied layout."""
    key = f"{topic}\x1e{segment_index}".encode("utf-8", errors="replace")
    h = 5381
    for b in key:
        h = (h * 33 + b) & 0xFFFFFFFF
    return h % EDU_PRESET_COUNT


def _clip(s: str, max_len: int) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def segments_to_storyboard(segments: list[dict], topic: str) -> dict[str, Any]:
    """Turn LLM segment map into Varin storyboard v1 (``edu_preset`` → catalog layout per segment)."""
    topic_title = _clip(topic.replace("\n", " "), 80)
    scenes: list[dict[str, Any]] = []
    for i, seg in enumerate(segments):
        narr = str(seg.get("narration") or seg.get("text", "")).strip()
        if not narr:
            narr = f"Part {i + 1}"
        vis = str(seg.get("text", narr)).strip()
        title = f"{topic_title} · {i + 1}/{len(segments)}" if len(segments) > 1 else topic_title
        try:
            dur = int(float(seg.get("duration_sec", 5)))
        except (TypeError, ValueError):
            dur = 5
        dur = max(3, min(90, dur))
        pidx = _edu_preset_index(topic, i)
        scenes.append(
            {
                "id": f"s{i + 1:02d}_seg",
                "visual_instruction": _clip(vis, 240),
                "narration": narr,
                "scene_template": "edu_preset",
                "template_params": {
                    "preset_index": pidx,
                    "title": _clip(title, 120),
                    "recap": _clip(narr, 900),
                },
                "duration_seconds": dur,
            }
        )
    return {"version": "v1", "scenes": scenes}


def single_topic_storyboard(topic: str, duration_seconds: int = 28) -> dict[str, Any]:
    """Single-scene fallback when segment planning is unavailable."""
    safe = _clip(topic.replace("\n", " "), 100) or "Topic"
    body = (
        f"• Structured overview of: {safe}\n"
        "• Follow your study plan for depth\n"
        "• Practice questions and coding challenges in EziLearning"
    )
    pidx = _edu_preset_index(safe, 0)
    return {
        "version": "v1",
        "scenes": [
            {
                "id": "s01_intro",
                "visual_instruction": "Title and recap board with key bullets.",
                "narration": f"Let's overview {safe}. Use your roadmap and practice tabs to go deeper.",
                "scene_template": "edu_preset",
                "template_params": {
                    "preset_index": pidx,
                    "title": safe,
                    "recap": _clip(body, 900),
                },
                "duration_seconds": max(8, min(60, duration_seconds)),
            }
        ],
    }


def run_storyboard_render(
    storyboard: dict[str, Any],
    work_dir: Path,
    output_mp4: Path,
    ffmpeg_exe: str,
    *,
    timeout_sec: int = 3600,
) -> bool:
    """
    Write ``storyboard.json`` under ``work_dir`` and run ``varin render-storyboard``.
    Returns True if ``output_mp4`` exists and is non-empty.
    """
    cli = get_varin_cli_executable()
    if not cli:
        logger.error(
            "Varin CLI not found. Build it: cd %s && cargo build --release "
            "(or set VARIN_CLI_PATH to the varin executable).",
            get_varin_rust_root(),
        )
        return False
    work_dir.mkdir(parents=True, exist_ok=True)
    sb_path = work_dir / "storyboard.json"
    sb_path.write_text(json.dumps(storyboard, ensure_ascii=False, indent=2), encoding="utf-8")
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    if output_mp4.exists():
        output_mp4.unlink()

    cmd = [
        str(cli),
        "render-storyboard",
        "--input",
        str(sb_path.resolve()),
        "--output",
        str(output_mp4.resolve()),
        "--ffmpeg",
        str(ffmpeg_exe),
    ]
    t0 = time.perf_counter()
    try:
        result = subprocess.run(
            cmd,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=os.environ.copy(),
        )
        elapsed = time.perf_counter() - t0
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "")[:1200]
            logger.warning("Varin render-storyboard failed (%.1fs, code=%s): %s", elapsed, result.returncode, err)
            return False
        ok = output_mp4.is_file() and output_mp4.stat().st_size > 0
        if not ok:
            logger.warning("Varin finished but output missing or empty: %s", output_mp4)
        return ok
    except subprocess.TimeoutExpired:
        logger.warning("Varin render-storyboard timed out after %ss", timeout_sec)
        return False
    except FileNotFoundError as e:
        logger.error("Varin subprocess failed: %s", e)
        return False
    except Exception as e:
        logger.warning("Varin render-storyboard error: %s", e)
        return False
