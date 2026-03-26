"""Text-to-Speech service: OpenAI TTS (preferred) or edge-tts (free fallback).
Supports per-segment generation for sync with video."""
import logging
import subprocess
from pathlib import Path

from core.config import settings
from core.ffmpeg_paths import get_ffmpeg_executable, get_ffprobe_executable

logger = logging.getLogger(__name__)

# Max chars per TTS request (OpenAI limit ~4096, edge-tts ~5000)
MAX_CHARS = 4000


def _get_caption_text(srt_path: Path | None, caption_text: str | None) -> str:
    """Extract spoken text from SRT file or caption_text. Returns clean text for TTS."""
    if caption_text and caption_text.strip():
        return caption_text.strip()[:MAX_CHARS]
    if srt_path and srt_path.exists():
        try:
            content = srt_path.read_text(encoding="utf-8")
            # Parse SRT: skip index and timestamps, keep text lines
            lines = content.split("\n")
            texts = []
            for line in lines:
                line = line.strip()
                if not line or line.isdigit():
                    continue
                if "-->" in line:
                    continue
                texts.append(line)
            return " ".join(texts).strip()[:MAX_CHARS] if texts else ""
        except Exception as e:
            logger.warning("Failed to read SRT for TTS: %s", e)
    return ""


def estimate_word_timestamps(text: str, start_sec: float, end_sec: float) -> list[dict]:
    """Estimate per-word timings in [start_sec, end_sec] using token-length weights."""
    tokens = [t for t in text.strip().split() if t]
    if not tokens or end_sec <= start_sec:
        return []
    weights = [max(1, len(t)) for t in tokens]
    total = float(sum(weights))
    cursor = float(start_sec)
    out: list[dict] = []
    for idx, tok in enumerate(tokens):
        span = (weights[idx] / total) * (end_sec - start_sec)
        out.append(
            {
                "index": idx,
                "word": tok,
                "start_sec": cursor,
                "end_sec": cursor + span,
            }
        )
        cursor += span
    return out


def generate_word_level_srt(segments: list[dict], output_path: Path) -> bool:
    """Generate one-word SRT cues using estimated timings from segment durations."""
    try:
        rows: list[str] = []
        t = 0.0
        cue = 1
        for seg in segments:
            dur = float(seg.get("duration_sec", 0) or 0)
            narration = str(seg.get("narration") or seg.get("text", "")).strip()
            if dur <= 0 or not narration:
                t += max(0.0, dur)
                continue
            words = estimate_word_timestamps(narration, t, t + dur)
            for w in words:
                rows.append(str(cue))
                rows.append(f"{_srt_time(w['start_sec'])} --> {_srt_time(w['end_sec'])}")
                rows.append(w["word"])
                rows.append("")
                cue += 1
            t += dur
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(rows), encoding="utf-8")
        return True
    except Exception as e:
        logger.warning("Word-level SRT generation failed: %s", e)
        return False


def _srt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_speech_openai(text: str, output_path: Path) -> bool:
    """Generate speech using OpenAI TTS API. Returns True on success."""
    if not text or len(text) < 10:
        return False
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        # tts-1 is fast/cheap, tts-1-hd for better quality
        model = "tts-1-hd" if len(text) < 2000 else "tts-1"
        with client.audio.speech.create(
            model=model,
            voice="nova",
            input=text[:MAX_CHARS],
            response_format="mp3",
        ) as response:
            response.stream_to_file(output_path)
        return output_path.exists()
    except Exception as e:
        logger.warning("OpenAI TTS failed: %s", e)
        return False


def generate_speech_edge(text: str, output_path: Path) -> bool:
    """Generate speech using edge-tts (free, no API key). Returns True on success."""
    if not text or len(text) < 10:
        return False
    try:
        import asyncio
        import edge_tts
        voice = "en-US-JennyNeural"
        communicate = edge_tts.Communicate(text[:MAX_CHARS], voice)
        asyncio.run(communicate.save(str(output_path)))
        return output_path.exists()
    except ImportError:
        logger.warning("edge-tts not installed. pip install edge-tts")
        return False
    except Exception as e:
        logger.warning("edge-tts failed: %s", e)
        return False


def generate_audio_from_captions(
    srt_path: Path | None,
    caption_text: str | None,
    output_path: Path,
) -> bool:
    """Generate audio from captions. Uses OpenAI TTS if key set, else edge-tts."""
    text = _get_caption_text(srt_path, caption_text)
    if not text:
        logger.info("No caption text for TTS, skipping audio")
        return False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if settings.openai_api_key:
        if generate_speech_openai(text, output_path):
            return True
        logger.info("OpenAI TTS failed, trying edge-tts")
    return generate_speech_edge(text, output_path)


def _generate_single_speech(text: str, output_path: Path) -> bool:
    """Generate speech for one segment. Returns True on success."""
    if not text or len(text) < 3:
        return False
    text = text[:MAX_CHARS].strip()
    if settings.openai_api_key and generate_speech_openai(text, output_path):
        return True
    return generate_speech_edge(text, output_path)


def _get_audio_duration_sec(path: Path, ffprobe_cmd: str | None = None) -> float | None:
    """Get audio duration in seconds. Returns None on failure."""
    cmd = ffprobe_cmd if ffprobe_cmd is not None else get_ffprobe_executable()
    try:
        r = subprocess.run(
            [cmd, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if r.returncode == 0 and r.stdout:
            return float(r.stdout.strip())
    except Exception:
        pass
    return None


def _pad_or_trim_audio(
    input_path: Path,
    output_path: Path,
    target_sec: float,
    ffmpeg_cmd: str | None = None,
    ffprobe_cmd: str | None = None,
) -> bool:
    """Pad or trim audio to target duration. Returns True on success."""
    if ffmpeg_cmd is None:
        ffmpeg_cmd = get_ffmpeg_executable()
    if ffprobe_cmd is None:
        ffprobe_cmd = get_ffprobe_executable()
    try:
        dur = _get_audio_duration_sec(input_path, ffprobe_cmd)
        if dur is None:
            dur = target_sec  # Assume match if we can't probe
        if abs(dur - target_sec) < 0.3:
            import shutil
            shutil.copy2(input_path, output_path)
            return True
        if dur > target_sec:
            # Trim to target
            result = subprocess.run(
                [ffmpeg_cmd, "-y", "-i", str(input_path), "-t", str(target_sec), "-c", "copy", str(output_path)],
                capture_output=True,
                text=True,
                timeout=30,
            )
        else:
            # Pad with silence: apad adds pad_dur seconds of silence at end
            pad_dur = max(0.1, target_sec - dur)
            result = subprocess.run(
                [ffmpeg_cmd, "-y", "-i", str(input_path), "-af", f"apad=pad_dur={pad_dur}", "-t", str(target_sec), str(output_path)],
                capture_output=True,
                text=True,
                timeout=30,
            )
        return result.returncode == 0 and output_path.exists()
    except Exception as e:
        logger.warning("Audio pad/trim failed: %s", e)
        return False


def generate_audio_segmented(
    segments: list[dict],
    output_path: Path,
    ffmpeg_cmd: str | None = None,
) -> bool:
    """Generate per-segment TTS, pad/trim each to match duration_sec, concat. Syncs audio with video."""
    if ffmpeg_cmd is None:
        ffmpeg_cmd = get_ffmpeg_executable()
    if not segments:
        return False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    work_dir = output_path.parent / f"_tts_{output_path.stem}"
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        segment_audios: list[Path] = []
        for i, seg in enumerate(segments):
            narration = str(seg.get("narration") or seg.get("text", "")).strip()
            if not narration:
                continue
            dur = float(seg.get("duration_sec", 4))
            raw_path = work_dir / f"seg_{i}.mp3"
            if not _generate_single_speech(narration, raw_path):
                logger.warning("TTS failed for segment %d", i)
                continue
            # Pad or trim to match segment duration
            timed_path = work_dir / f"seg_{i}_timed.mp3"
            if not _pad_or_trim_audio(raw_path, timed_path, dur, ffmpeg_cmd):
                timed_path = raw_path  # Use as-is if pad/trim fails
            segment_audios.append(timed_path)
        if not segment_audios:
            return False
        if len(segment_audios) == 1:
            import shutil
            shutil.copy2(segment_audios[0], output_path)
            return True
        # Concat audio files (relative paths for portability)
        concat_file = work_dir / "concat.txt"
        lines = [f"file '{p.name}'" for p in segment_audios]
        concat_file.write_text("\n".join(lines), encoding="utf-8")
        result = subprocess.run(
            [
                ffmpeg_cmd,
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_file),
                "-c", "copy",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(work_dir),
        )
        return result.returncode == 0 and output_path.exists()
    except Exception as e:
        logger.warning("Segmented TTS failed: %s", e)
        return False
    finally:
        try:
            import shutil
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass
