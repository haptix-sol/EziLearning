"""Varin telemetry: record render outcomes, categorize failures, summarize for improvement loops."""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal
from models.varin_telemetry import VarinRenderEvent

logger = logging.getLogger(__name__)

DETAIL_MAX = 2000

# Bump when you change LLM system prompts in video_generator (track regressions in DB).
VARIN_PROMPT_VERSION = "2025-03-20"


def categorize_failure_detail(detail: str | None) -> str:
    """Coarse bucket for trends (not for user display)."""
    if not detail:
        return "unknown"
    t = detail.lower()
    checks: list[tuple[str, tuple[str, ...]]] = [
        ("latex", ("latex", "tex put", "! latex", "kpsewhich", "miktex")),
        ("opengl_gl", ("moderngl", "opengl", "shader", "glsl", "gl error")),
        ("ffmpeg", ("ffmpeg", "invalid data", "codec", "concat")),
        ("syntax", ("syntaxerror", "indentationerror")),
        ("timeout", ("timeout", "timed out")),
        ("file_missing", ("filenotfounderror", "no such file", "errno 2", "winerror 2")),
        ("import", ("importerror", "modulenotfounderror")),
    ]
    for cat, needles in checks:
        if any(n in t for n in needles):
            return cat
    if "traceback" in t:
        return "python_exception"
    return "unknown"


def record_varin_event(
    *,
    event_type: str,
    success: bool,
    duration_ms: int | None = None,
    video_id: str | None = None,
    user_id: str | None = None,
    topic: str | None = None,
    video_style: str | None = None,
    segment_index: int | None = None,
    scene_name: str | None = None,
    exit_code: int | None = None,
    detail: str | None = None,
    error_category: str | None = None,
    prompt_version: str | None = None,
) -> None:
    """Persist one event; never raises (telemetry must not break video generation)."""
    try:
        if detail and len(detail) > DETAIL_MAX:
            detail = detail[: DETAIL_MAX - 3] + "..."
        if not success and not error_category:
            error_category = categorize_failure_detail(detail)
        row = VarinRenderEvent(
            event_type=event_type,
            success=success,
            duration_ms=duration_ms,
            video_id=video_id,
            user_id=user_id,
            topic=topic,
            video_style=video_style,
            segment_index=segment_index,
            scene_name=scene_name,
            exit_code=exit_code,
            error_category=error_category,
            detail=detail,
            prompt_version=prompt_version or VARIN_PROMPT_VERSION,
        )
        db = SessionLocal()
        try:
            db.add(row)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.debug("Varin telemetry skipped: %s", e)


def summarize_events(db: Session, *, since: datetime) -> dict[str, Any]:
    """Aggregates for reports and LLM review."""
    stmt = select(VarinRenderEvent).where(VarinRenderEvent.created_at >= since)
    rows = list(db.scalars(stmt).all())
    total = len(rows)
    ok = sum(1 for r in rows if r.success)
    by_type = Counter(r.event_type for r in rows)
    fail_by_cat = Counter(
        (r.error_category or "unknown") for r in rows if not r.success
    )
    dur_ok = [r.duration_ms for r in rows if r.success and r.duration_ms is not None]
    p50_ms = None
    if dur_ok:
        s = sorted(dur_ok)
        p50_ms = s[len(s) // 2]
    # Top failing topics (success=False, has topic)
    fail_topics = Counter(
        (r.topic or "") for r in rows if not r.success and r.topic
    )
    top_fail_topics = fail_topics.most_common(8)
    return {
        "since": since.isoformat(),
        "total_events": total,
        "success_count": ok,
        "failure_count": total - ok,
        "success_rate": round(ok / total, 4) if total else None,
        "by_event_type": dict(by_type),
        "failures_by_category": dict(fail_by_cat),
        "median_duration_ms_success_only": p50_ms,
        "top_failure_topics": [(t, c) for t, c in top_fail_topics if t],
    }


def print_insights_report(days: int | None = None) -> None:
    """CLI: print markdown-friendly summary to stdout. Optional days: ``sys.argv[1]`` when run as a script."""
    import sys

    if days is None:
        days = 14
        if len(sys.argv) > 1:
            try:
                days = max(1, min(365, int(sys.argv[1])))
            except ValueError:
                pass

    from database import init_db as ensure_tables

    ensure_tables()
    db = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        s = summarize_events(db, since=since)
        print(f"# Varin insights (last {days} days)\n")
        print(f"- **Events:** {s['total_events']}")
        print(f"- **Success:** {s['success_count']} | **Failed:** {s['failure_count']}")
        if s["success_rate"] is not None:
            print(f"- **Success rate:** {s['success_rate']:.1%}")
        if s["median_duration_ms_success_only"]:
            print(f"- **Median duration ms (successful renders only):** {s['median_duration_ms_success_only']}")
        print("\n## By event type\n")
        for k, v in sorted(s["by_event_type"].items(), key=lambda x: -x[1]):
            print(f"- `{k}`: {v}")
        print("\n## Failure categories\n")
        fc = s["failures_by_category"]
        if not fc:
            print("_No failures in window._")
        else:
            for k, v in sorted(fc.items(), key=lambda x: -x[1]):
                print(f"- `{k}`: {v}")
        print("\n## Topics with most failures\n")
        if not s["top_failure_topics"]:
            print("_None._")
        else:
            for t, c in s["top_failure_topics"]:
                print(f"- {t[:80]!r}: {c}")
        print("\n---\nUse this with `docs/VARIN_IMPROVEMENT_LOOP.md` to adjust prompts and add regression scenes.\n")
    finally:
        db.close()
