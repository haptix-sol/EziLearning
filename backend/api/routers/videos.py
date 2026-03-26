"""Video tutorial generation and listing."""
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError
from models import GeneratedVideo
from services.video_generator import cleanup_video_residue

router = APIRouter(prefix="/videos", tags=["videos"])


@router.get("")
def list_videos(current_user: CurrentUser, db: Session = Depends(get_db)):
    """List user's generated videos (all statuses) + pre-rendered animations."""
    videos = (
        db.query(GeneratedVideo)
        .filter(GeneratedVideo.user_id == current_user.id)
        .order_by(GeneratedVideo.created_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for v in videos:
        pct = v.progress_percent or 0
        if v.status == "generating" and (sd := getattr(v, "segments_done", None)) is not None and (st := getattr(v, "segments_total", None)) and st > 0:
            pct = min(90, 15 + (sd * 70 // st))
        est_sec = None
        if v.status == "generating" and pct < 100:
            est_sec = max(60, int((100 - pct) / 100 * 600))
        result.append({
            "id": v.id,
            "topic": v.topic,
            "status": v.status,
            "url": f"/videos/file/{v.id}" if v.file_path else None,
            "captions_url": f"/videos/captions/{v.id}" if v.caption_file_path else None,
            "progress_percent": pct,
            "status_message": getattr(v, "status_message", None),
            "segments_done": getattr(v, "segments_done", None),
            "segments_total": getattr(v, "segments_total", None),
            "estimated_seconds_remaining": est_sec,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        })
    return result


@router.get("/file/{video_id}")
def get_video_file(
    video_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Serve the generated video file."""
    v = db.query(GeneratedVideo).filter(
        GeneratedVideo.id == video_id,
        GeneratedVideo.user_id == current_user.id,
        GeneratedVideo.status == "completed",
    ).first()
    if not v or not v.file_path:
        raise NotFoundError("Video not found")
    path = Path(v.file_path)
    if not path.exists():
        raise NotFoundError("Video file not found")
    return FileResponse(path, media_type="video/mp4")


@router.get("/captions/{video_id}")
def get_video_captions(
    video_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Serve the SRT captions file for TTS/voice generation."""
    v = db.query(GeneratedVideo).filter(
        GeneratedVideo.id == video_id,
        GeneratedVideo.user_id == current_user.id,
        GeneratedVideo.status == "completed",
    ).first()
    if not v or not v.caption_file_path:
        raise NotFoundError("Captions not found")
    path = Path(v.caption_file_path)
    if not path.exists():
        raise NotFoundError("Caption file not found")
    return FileResponse(
        path,
        media_type="text/plain",
        filename=path.name,
    )


@router.get("/{video_id}/status")
def get_video_status(video_id: str, current_user: CurrentUser, db: Session = Depends(get_db)):
    """Get video generation progress."""
    if video_id.startswith("static-"):
        return {"id": video_id, "status": "completed", "progress_percent": 100}
    v = db.query(GeneratedVideo).filter(
        GeneratedVideo.id == video_id,
        GeneratedVideo.user_id == current_user.id,
    ).first()
    if not v:
        raise NotFoundError("Video not found")
    pct = v.progress_percent or 0
    # Use segments for more accurate progress when available
    if v.status == "generating" and (sd := getattr(v, "segments_done", None)) is not None and (st := getattr(v, "segments_total", None)) and st > 0:
        pct = min(90, 15 + (sd * 70 // st))
    est_sec = max(60, int((100 - pct) / 100 * 600)) if v.status == "generating" and pct < 100 else None
    return {
        "id": v.id,
        "topic": v.topic,
        "status": v.status,
        "progress_percent": pct,
        "status_message": getattr(v, "status_message", None),
        "segments_done": getattr(v, "segments_done", None),
        "segments_total": getattr(v, "segments_total", None),
        "estimated_seconds_remaining": est_sec,
        "url": f"/videos/file/{v.id}" if v.status == "completed" and v.file_path else None,
        "captions_url": f"/videos/captions/{v.id}" if v.caption_file_path else None,
    }


@router.post("/{video_id}/cancel")
def cancel_video_generation(
    video_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Stop an in-progress generation. The worker exits at the next checkpoint; Varin may finish the current render."""
    if video_id.startswith("static-"):
        return {"ok": False, "message": "Static assets cannot be cancelled"}
    v = db.query(GeneratedVideo).filter(
        GeneratedVideo.id == video_id,
        GeneratedVideo.user_id == current_user.id,
    ).first()
    if not v:
        raise NotFoundError("Video not found")
    if v.status != "generating":
        return {"ok": False, "message": "Not generating", "status": v.status}
    v.status = "failed"
    v.status_message = "Cancelled by user"
    v.progress_percent = 0
    v.segments_done = None
    v.segments_total = None
    db.commit()
    cleanup_video_residue(video_id, str(current_user.id), v.topic)
    return {"ok": True, "id": v.id, "status": v.status, "status_message": v.status_message}


@router.delete("/{video_id}")
def delete_video(video_id: str, current_user: CurrentUser, db: Session = Depends(get_db)):
    """Delete a video (failed or completed) and clean up all residue (segments, partial files)."""
    if video_id.startswith("static-"):
        return {"message": "Static animations cannot be deleted"}
    v = db.query(GeneratedVideo).filter(
        GeneratedVideo.id == video_id,
        GeneratedVideo.user_id == current_user.id,
    ).first()
    if not v:
        raise NotFoundError("Video not found")
    cleanup_video_residue(video_id, str(current_user.id), v.topic)
    if v.file_path:
        p = Path(v.file_path)
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass
    if v.caption_file_path:
        p = Path(v.caption_file_path)
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass
    db.delete(v)
    db.commit()
    return {"message": "Video and residue deleted"}


# Video generation is only via POST /study/days/{day_id}/generate-video (study plan topics only)
