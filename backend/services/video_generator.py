"""AI-generated educational video via the bundled **Rust Varin** CLI (``render-storyboard``).

LLM builds a segment plan; segments become Varin storyboard scenes (``recap_board`` templates).
Requires a release ``varin`` binary under ``backend/Varin/target/release/`` (``cargo build --release``).
Only one video generates at a time to avoid resource exhaustion."""
import logging
import re
import shutil
import subprocess
import threading
from pathlib import Path
from datetime import datetime, timezone

from core.config import settings
from core.ffmpeg_paths import BACKEND_ROOT, REPO_ROOT, get_ffmpeg_executable, get_ffprobe_executable
from core.varin_paths import get_varin_render_work_root
from core.varin_storyboard import (
    run_storyboard_render,
    segments_to_storyboard,
    single_topic_storyboard,
)
from services.llm_client import llm_service
from services.tts_service import (
    generate_audio_from_captions,
    generate_audio_segmented,
    generate_word_level_srt,
)
from services.varin_telemetry import VARIN_PROMPT_VERSION, record_varin_event

logger = logging.getLogger(__name__)

# Only one video generation at a time (avoids parallel Varin + FFmpeg resource exhaustion)
_video_gen_lock = threading.Lock()


# Segment map drives scene count for the Varin storyboard. Only segment count and total duration vary.
# est_generation_min/max: rough time to generate (Varin render + TTS), in minutes
VIDEO_STYLES = {
    "short": {
        "label": "1-2 min",
        "desc": "Straightforward",
        "total_sec": (75, 120),
        "segments": (15, 25),
        "seg_dur": (3, 6),
        "est_generation_min": 3,
        "est_generation_max": 6,
    },
    "parallel": {
        "label": "~3 min",
        "desc": "Many short segments, parallel render",
        "total_sec": (165, 195),
        "segments": (30, 40),
        "seg_dur": (3, 6),
        "est_generation_min": 5,
        "est_generation_max": 10,
    },
    "explanatory": {
        "label": "2-5 min",
        "desc": "Explanatory",
        "total_sec": (120, 300),
        "segments": (24, 50),
        "seg_dur": (3, 6),
        "est_generation_min": 5,
        "est_generation_max": 15,
    },
    "pictorial": {
        "label": "4-7 min",
        "desc": "Pictorial with examples",
        "total_sec": (240, 420),
        "segments": (45, 80),
        "seg_dur": (3, 6),
        "est_generation_min": 10,
        "est_generation_max": 25,
    },
}


def _parse_segment_map_response(raw: str | dict | None) -> list[dict] | None:
    """Parse LLM response into validated segment list. Handles JSON, markdown code blocks."""
    import json
    if raw is None:
        return None
    data = raw
    if isinstance(raw, str):
        s = raw.strip()
        # Try direct JSON
        try:
            data = json.loads(s)
        except json.JSONDecodeError:
            # Extract from markdown code block
            m = re.search(r"```(?:json)?\s*([\s\S]*?)```", s)
            if m:
                try:
                    data = json.loads(m.group(1).strip())
                except json.JSONDecodeError:
                    return None
            else:
                # Try finding {"segments": ...}
                m = re.search(r'\{[^{}]*"segments"\s*:\s*\[[\s\S]*\]\s*\}', s)
                if m:
                    try:
                        data = json.loads(m.group(0))
                    except json.JSONDecodeError:
                        return None
                else:
                    return None
    if not isinstance(data, dict) or "segments" not in data:
        return None
    segs = data["segments"]
    if not isinstance(segs, list) or len(segs) == 0:
        return None
    # Validate and normalize each segment
    valid = []
    dur_min, dur_max = 3, 6
    for i, s in enumerate(segs):
        if not isinstance(s, dict):
            continue
        dur = s.get("duration_sec")
        if dur is None:
            dur = s.get("duration_seconds", 4)
        try:
            dur = max(dur_min, min(dur_max, int(float(dur))))
        except (TypeError, ValueError):
            dur = 4
        text = str(s.get("text", "")).strip()
        narration = str(s.get("narration", "")).strip()
        # If narration missing or looks like instruction (Show/Draw/Fade), use text as fallback for TTS
        if not narration or any(narration.lower().startswith(p) for p in ("show ", "draw ", "fade ", "display ", "create ")):
            narration = narration or text
        if not text:
            text = narration[:100] if narration else f"Explain step {i + 1}"
        valid.append({
            "duration_sec": dur,
            "text": text,
            "narration": narration or text,
        })
    return valid if valid else None


def generate_segment_map(topic: str, video_style: str = "explanatory") -> list[dict] | None:
    """Use LLM to create a segment map. Returns validated list with duration_sec, text, narration."""
    if not llm_service.client:
        return None
    style = VIDEO_STYLES.get(video_style, VIDEO_STYLES["explanatory"])
    total_min, total_max = style["total_sec"][0] // 60, style["total_sec"][1] // 60
    seg_min, seg_max = style["segments"]
    dur_min, dur_max = style["seg_dur"]

    style_guide = {
        "short": "Keep it concise. Focus on key points only. Minimal but clear visuals.",
        "explanatory": "Explain step-by-step. Build understanding progressively. Use diagrams and flow.",
        "pictorial": "Rich visuals with multiple examples. Show real-world applications.",
        "parallel": "Each segment is a micro-step (3-6s). Same visual structure: dark bg, white/blue accents.",
    }.get(video_style, "")
    style_guide = style_guide + " Each segment: 3-6 seconds."

    prompt = f"""For the topic "{topic}", create an educational video segment map.
Return ONLY valid JSON. No markdown, no code fences, no extra text. Exact format:
{{"segments": [{{"duration_sec": 5, "text": "Draw title and intro shapes", "narration": "Welcome. Today we explore the fundamentals."}}, ...]}}

CRITICAL - SYNC: Visuals and narration must align. The narrator describes what appears AS it appears.
- "text": Visual direction for the scene (shown to Varin as recap context). Short. Never spoken aloud.
- "narration": Paced to match visuals. First words = first visual element. Keep short (1-2 sentences).
  Structure: opening phrase describes what appears first, then brief explanation as it builds.
  Example: "Here is the title." (as title appears) or "Notice the arrow." (as arrow draws).
  Avoid long intros. The narration should flow WITH the visual, not ahead or behind.
- {seg_min}-{seg_max} segments, each {dur_min}-{dur_max} seconds, total {total_min}-{total_max} min."""
    try:
        result = llm_service._call(
            "You are a video script writer. Return ONLY valid JSON with a 'segments' array. No markdown.",
            prompt,
            temperature=0.3,
            model=llm_service.video_model,
        )
        if result:
            segs = _parse_segment_map_response(result)
            if segs:
                max_seg = {"short": 25, "explanatory": 50, "pictorial": 80, "parallel": 45}.get(video_style, 50)
                return segs[:max_seg] if len(segs) > max_seg else segs
    except Exception as e:
        logger.warning("Segment map parse failed: %s", e)
    return None


def generate_captions_srt(segments: list[dict], output_path: Path) -> bool:
    """Write SRT captions from segment map. Uses narration (voice-over) when present, else text."""
    try:
        lines = []
        start = 0.0
        for i, seg in enumerate(segments, 1):
            dur = float(seg.get("duration_sec", 3))
            # Use narration for TTS/captions (explanatory), fallback to text (animation instruction)
            text = str(seg.get("narration") or seg.get("text", ""))
            end = start + dur
            lines.append(f"{i}\n{_srt_time(start)} --> {_srt_time(end)}\n{text}\n")
            start = end
        output_path.write_text("\n".join(lines), encoding="utf-8")
        return True
    except Exception:
        return False


def _srt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"



def _video_still_generating(db, video_id: str) -> bool:
    """False if row missing or user cancelled (status is no longer ``generating``)."""
    from models import GeneratedVideo

    row = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
    return bool(row and row.status == "generating")


def cleanup_video_residue(video_id: str, user_id: str, topic: str) -> None:
    """Remove all residue from a failed or deleted video: work dir, partial mp4, srt."""
    render_root = get_varin_render_work_root()
    work_dir = render_root / str(user_id) / video_id
    base = Path(settings.videos_storage_path).resolve()
    out_dir = base / str(user_id)
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")[:50] or "video"
    final_path = out_dir / f"{slug}-{video_id[:8]}.mp4"
    srt_path = out_dir / f"{slug}-{video_id[:8]}.srt"
    try:
        if work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)
            logger.info("Cleaned work dir: %s", work_dir)
        if final_path.exists():
            final_path.unlink()
            logger.info("Removed partial mp4: %s", final_path)
        if srt_path.exists():
            srt_path.unlink()
            logger.info("Removed srt: %s", srt_path)
    except Exception as e:
        logger.warning("Cleanup residue failed for %s: %s", video_id, e)



def generate_video_for_topic(
    video_id: str,
    topic: str,
    user_id: str,
    video_style: str = "explanatory",
) -> None:
    """Background task: generate video, save to local disk, store only path in DB.
    Video file is stored at data/videos/{user_id}/. DB stores file_path string only.
    Only one video generates at a time to avoid resource exhaustion."""
    _video_gen_lock.acquire(blocking=True)
    try:
        _generate_video_for_topic_impl(video_id, topic, user_id, video_style)
    finally:
        _video_gen_lock.release()


def _generate_video_for_topic_impl(video_id: str, topic: str, user_id: str, video_style: str = "explanatory") -> None:
    """Internal implementation of video generation."""
    from database import SessionLocal
    from models import GeneratedVideo

    db = SessionLocal()
    try:
        v = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
        if not v:
            return
        if v.status != "generating":
            logger.info("Skip generation for %s: status=%s (e.g. cancelled before start)", video_id, v.status)
            return
        v.progress_percent = 5
        v.status_message = "Planning segments..."
        db.commit()

        base = Path(settings.videos_storage_path).resolve()
        base.mkdir(parents=True, exist_ok=True)
        out_dir = base / str(user_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        slug = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")[:50] or "video"
        final_path = out_dir / f"{slug}-{video_id[:8]}.mp4"
        srt_path = out_dir / f"{slug}-{video_id[:8]}.srt"

        segments = generate_segment_map(topic, video_style)
        if not _video_still_generating(db, video_id):
            logger.info("Video %s cancelled after segment planning step", video_id)
            return
        ffmpeg_cmd = get_ffmpeg_executable()
        video_ok = False
        had_segment_plan = bool(segments and len(segments) >= 1)
        synced_segment_audio = False

        if had_segment_plan:
            v.progress_percent = 15
            v.status_message = f"Planned {len(segments)} scenes for Varin"
            v.segments_done = 0
            v.segments_total = len(segments)
            db.commit()
            if not _video_still_generating(db, video_id):
                logger.info("Video %s cancelled before captions", video_id)
                return
            generate_captions_srt(segments, srt_path)
            generate_word_level_srt(segments, srt_path)
            v.caption_text = " ".join(s.get("narration") or s.get("text", "") for s in segments)

            work_dir = get_varin_render_work_root() / str(user_id) / video_id
            work_dir.mkdir(parents=True, exist_ok=True)
            tmp_mp4 = work_dir / "varin_rendered.mp4"
            storyboard = segments_to_storyboard(segments, topic)
            timeout_sec = max(300, min(7200, len(segments) * 90))
            v.progress_percent = 35
            v.status_message = "Rendering with Varin (Rust engine)..."
            db.commit()
            if not _video_still_generating(db, video_id):
                logger.info("Video %s cancelled before Varin render", video_id)
                try:
                    shutil.rmtree(work_dir, ignore_errors=True)
                except Exception:
                    pass
                return

            ok = run_storyboard_render(
                storyboard, work_dir, tmp_mp4, ffmpeg_cmd, timeout_sec=timeout_sec
            )
            record_varin_event(
                event_type="render_storyboard",
                success=ok and tmp_mp4.is_file(),
                detail=None if ok else "varin render-storyboard failed or missing output",
                video_id=video_id,
                user_id=user_id,
                topic=topic,
                video_style=video_style,
                prompt_version=VARIN_PROMPT_VERSION,
            )
            db.refresh(v)
            if v.status != "generating":
                logger.info("Video %s cancelled after Varin render (discarding output)", video_id)
                try:
                    shutil.rmtree(work_dir, ignore_errors=True)
                except Exception:
                    pass
                return
            if ok and tmp_mp4.is_file():
                shutil.copy2(tmp_mp4, final_path)
                video_ok = True
                synced_segment_audio = True
                v.segments_done = len(segments)
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception as e:
                logger.warning("Varin work dir cleanup failed: %s", e)

        if not video_ok:
            v.progress_percent = max(v.progress_percent or 0, 12)
            v.status_message = "Fallback: single-scene Varin render..."
            db.commit()
            if not _video_still_generating(db, video_id):
                logger.info("Video %s cancelled before fallback render", video_id)
                return
            fb_dir = get_varin_render_work_root() / str(user_id) / f"{video_id}_fb"
            fb_dir.mkdir(parents=True, exist_ok=True)
            fb_out = fb_dir / "varin_fallback.mp4"
            fb_sb = single_topic_storyboard(topic)
            ok_fb = run_storyboard_render(fb_sb, fb_dir, fb_out, ffmpeg_cmd, timeout_sec=900)
            record_varin_event(
                event_type="render_storyboard_fallback",
                success=ok_fb and fb_out.is_file(),
                detail=None if ok_fb else "fallback render-storyboard failed",
                video_id=video_id,
                user_id=user_id,
                topic=topic,
                video_style=video_style,
                prompt_version=VARIN_PROMPT_VERSION,
            )
            db.refresh(v)
            if v.status != "generating":
                logger.info("Video %s cancelled after fallback Varin render", video_id)
                try:
                    shutil.rmtree(fb_dir, ignore_errors=True)
                except Exception:
                    pass
                return
            if ok_fb and fb_out.is_file():
                shutil.copy2(fb_out, final_path)
                video_ok = True
            try:
                shutil.rmtree(fb_dir, ignore_errors=True)
            except Exception as e:
                logger.warning("Varin fallback dir cleanup failed: %s", e)

            if not had_segment_plan:
                v.caption_text = f"Educational overview: {topic}"
                generate_captions_srt(
                    [{"duration_sec": 28, "narration": v.caption_text, "text": topic}],
                    srt_path,
                )
                generate_word_level_srt(
                    [{"duration_sec": 28, "narration": v.caption_text, "text": topic}],
                    srt_path,
                )
                db.commit()

        if not video_ok or not final_path.exists():
            db.refresh(v)
            if v.status != "generating":
                logger.info("Video %s stopped (status=%s); not deleting row", video_id, v.status)
                return
            logger.error("Varin video generation failed for topic=%s (is the CLI built? cargo build --release)", topic)
            cleanup_video_residue(video_id, user_id, topic)
            db.delete(v)
            db.commit()
            return

        # Generate TTS audio and merge into video (per-segment when segment plan was used)
        if final_path.exists() and (srt_path.exists() or v.caption_text):
            if not _video_still_generating(db, video_id):
                logger.info("Video %s cancelled before audio", video_id)
                cleanup_video_residue(video_id, user_id, topic)
                return
            v.progress_percent = 92
            v.status_message = "Generating audio..."
            db.commit()
            audio_path = out_dir / f"{slug}-{video_id[:8]}-audio.mp3"
            # Per-segment TTS when we had a segment map (timing aligned to planned segments)
            if synced_segment_audio and segments and len(segments) >= 1:
                if generate_audio_segmented(segments, audio_path, ffmpeg_cmd):
                    v.progress_percent = 96
                    v.status_message = "Merging audio..."
                    db.commit()
                    if merge_video_with_audio(final_path, audio_path):
                        logger.info("Added synced TTS audio to video: %s", topic)
                    audio_path.unlink(missing_ok=True)
            else:
                if generate_audio_from_captions(srt_path if srt_path.exists() else None, v.caption_text, audio_path):
                    v.progress_percent = 96
                    v.status_message = "Merging audio..."
                    db.commit()
                    if merge_video_with_audio(final_path, audio_path):
                        logger.info("Added TTS audio to video: %s", topic)
                    audio_path.unlink(missing_ok=True)

        # Only store path in DB after video is successfully saved to disk
        if not _video_still_generating(db, video_id):
            logger.info("Video %s cancelled before final commit (cleaning up file)", video_id)
            cleanup_video_residue(video_id, user_id, topic)
            return
        caption_path = str(srt_path) if srt_path.exists() else None
        v.file_path = str(final_path)
        v.caption_file_path = caption_path
        v.status = "completed"
        v.progress_percent = 100
        v.status_message = "Completed"
        v.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        logger.exception("Video generation failed for topic=%s: %s", topic, e)
        try:
            failed_v = db.query(GeneratedVideo).filter(GeneratedVideo.id == video_id).first()
            if failed_v:
                failed_v.status = "failed"
                failed_v.status_message = "Video generation failed"
                failed_v.progress_percent = 0
                db.commit()
                cleanup_video_residue(video_id, user_id, topic)
        except Exception:
            pass
    finally:
        db.close()
