"""LLM-generated guided (visual) lesson manifests — cached per user/day/topic."""
from __future__ import annotations

import copy
import logging
from typing import Any

from services.llm_client import llm_service
from services.visual_lesson_catalog import (
    build_visual_lesson_manifest,
    personalize_visual_manifest,
    topic_key,
)

logger = logging.getLogger(__name__)

_ALLOWED_DIAGRAM = frozenset(
    {
        "generic",
        "flowchart",
        "box_arrow",
        "step_chain",
        "ipo",
        "request_response",
        "memory_state",
        "before_after",
        "code_board",
        "algorithm_trace",
    }
)

_ALLOWED_KINDS = frozenset(
    {
        "intro",
        "objectives",
        "concept",
        "step",
        "code",
        "summary",
        "recap",
        "checkpoint",
        "practice",
    }
)


def _default_anim() -> dict[str, Any]:
    return {"steps": [{"id": "default", "reveal_ids": [], "highlight_ids": []}]}


def _repair_slide(raw: dict[str, Any], index: int) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    sid = str(raw.get("id") or f"slide-{index}").strip() or f"slide-{index}"
    kind = str(raw.get("kind") or "concept").strip().lower()
    if kind not in _ALLOWED_KINDS:
        kind = "concept"
    title = str(raw.get("title") or f"Slide {index + 1}").strip() or f"Slide {index + 1}"
    short = str(raw.get("short_explanation") or raw.get("short") or "").strip()
    dt = str(raw.get("diagram_type") or "generic").strip()
    if dt not in _ALLOWED_DIAGRAM:
        dt = "generic"
    dd = raw.get("diagram_data")
    if not isinstance(dd, dict):
        dd = {}
    narration = str(raw.get("narration_text") or "").strip()
    ck = raw.get("caption_keywords")
    if not isinstance(ck, list):
        ck = []
    ck = [str(x) for x in ck if str(x).strip()][:8]
    out: dict[str, Any] = {
        "id": sid[:80],
        "kind": kind,
        "title": title[:200],
        "short_explanation": short[:500] if short else "",
        "diagram_type": dt,
        "diagram_data": dd,
        "code_example": raw.get("code_example") if isinstance(raw.get("code_example"), dict) else None,
        "highlight_targets": raw.get("highlight_targets") if isinstance(raw.get("highlight_targets"), list) else [],
        "animation_sequence": raw.get("animation_sequence")
        if isinstance(raw.get("animation_sequence"), dict)
        else _default_anim(),
        "narration_text": narration[:4000],
        "audio_url": raw.get("audio_url"),
        "caption_keywords": ck,
        "checkpoint_question": None,
        "checkpoint_options": None,
        "checkpoint_answer_index": None,
        "summary_points": None,
        "quiz": None,
    }
    if kind == "checkpoint":
        cq = raw.get("checkpoint_question")
        co = raw.get("checkpoint_options")
        ai = raw.get("checkpoint_answer_index")
        if isinstance(cq, str) and cq.strip() and isinstance(co, list) and len(co) >= 2:
            opts = [str(x).strip() for x in co if str(x).strip()][:6]
            try:
                aidx = int(ai) if ai is not None else 0
            except (TypeError, ValueError):
                aidx = 0
            aidx = max(0, min(aidx, len(opts) - 1))
            out["checkpoint_question"] = cq.strip()[:500]
            out["checkpoint_options"] = opts
            out["checkpoint_answer_index"] = aidx
        else:
            out["kind"] = "concept"
    if kind == "practice" and isinstance(raw.get("quiz"), dict):
        qz = raw["quiz"]
        q = str(qz.get("question") or "").strip()
        opts = qz.get("options")
        ans = qz.get("answer_index")
        if q and isinstance(opts, list) and len(opts) >= 2:
            o2 = [str(x).strip() for x in opts if str(x).strip()][:6]
            try:
                ai2 = int(ans) if ans is not None else 0
            except (TypeError, ValueError):
                ai2 = 0
            ai2 = max(0, min(ai2, len(o2) - 1))
            out["quiz"] = {"question": q[:500], "options": o2, "answer_index": ai2}
    sp = raw.get("summary_points")
    if isinstance(sp, list) and sp:
        out["summary_points"] = [str(x).strip() for x in sp if str(x).strip()][:12]
    return out


def _coerce_manifest_core(
    raw: dict[str, Any],
    *,
    topic: str,
    day_title: str,
    day_id: str,
    day_number: int,
    activity_type: str,
    subtopics: list[str] | None,
    apply_personalize: bool,
) -> dict[str, Any] | None:
    slides_in = raw.get("slides")
    if not isinstance(slides_in, list) or len(slides_in) < 4:
        return None
    slides: list[dict[str, Any]] = []
    for i, s in enumerate(slides_in[:14]):
        fixed = _repair_slide(s, i)
        if fixed:
            slides.append(fixed)
    if len(slides) < 4:
        return None
    tk = topic_key(topic)
    base: dict[str, Any] = {
        "lesson_title": str(raw.get("lesson_title") or topic).strip()[:240] or topic,
        "lesson_objective": str(raw.get("lesson_objective") or "").strip()[:800]
        or f"Understand {topic} in the context of {day_title}.",
        "lesson_type": str(raw.get("lesson_type") or "ai_generated").strip()[:64] or "ai_generated",
        "topic_key": tk,
        "day_context": day_title,
        "slides": slides,
    }
    if apply_personalize:
        return personalize_visual_manifest(
            base,
            day_id=day_id,
            day_number=day_number,
            day_title=day_title,
            activity_type=activity_type or "study",
            topic=topic,
            subtopics=subtopics,
        )
    return base


def sanitize_llm_manifest(
    raw: dict[str, Any] | None,
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
    subtopics: list[str] | None,
) -> dict[str, Any] | None:
    """Return a safe manifest dict or None if unusable (applies personalization once)."""
    if not raw or not isinstance(raw, dict):
        return None
    return _coerce_manifest_core(
        raw,
        topic=topic,
        day_title=day_title,
        day_id=day_id,
        day_number=day_number,
        activity_type=activity_type,
        subtopics=subtopics,
        apply_personalize=True,
    )


def coerce_stored_manifest(
    stored: dict[str, Any],
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
) -> dict[str, Any] | None:
    """Repair cached manifest for API response without re-running personalization (avoids duplicate subtopic tails)."""
    return _coerce_manifest_core(
        stored,
        topic=topic,
        day_title=day_title,
        day_id=day_id,
        day_number=day_number,
        activity_type=activity_type,
        subtopics=None,
        apply_personalize=False,
    )


def generate_visual_manifest_with_llm(
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
    subtopics: list[str] | None,
) -> dict[str, Any] | None:
    """Ask the LLM for a full visual-lesson JSON manifest. Returns None on failure."""
    if not llm_service.is_configured():
        logger.warning("visual lesson LLM: not configured")
        return None
    subs = subtopics or []
    sub_block = ""
    if subs:
        sub_block = "Subtopics for this topic (weave into slides): " + "; ".join(subs[:12]) + ".\n"
    system = """You are an expert technical educator building a "guided lesson" for a slide player UI.
Return a single JSON object only (no markdown). Required top-level keys:
- "lesson_title": string (short)
- "lesson_objective": string (1-2 sentences)
- "lesson_type": string (e.g. "interview_prep")
- "slides": array of 6 to 10 slide objects

Each slide object MUST include:
- "id": unique string
- "kind": one of intro, objectives, concept, step, summary, recap, checkpoint, practice
- "title": string
- "short_explanation": string (one line)
- "diagram_type": one of generic, flowchart, box_arrow, step_chain, ipo
- "diagram_data": object (structure depends on diagram_type)
- "narration_text": string (2-4 sentences, plain text for optional TTS)
- "caption_keywords": array of 2-5 short strings

diagram_data shapes (use reasonable coordinates/labels):
- generic: { "headline": "...", "sub": "..." } OR { "bullets": ["...", "..."] }
- step_chain: { "steps": [ {"id":"a","label":"..."}, ... ] } at least 3 steps
- ipo: { "input_label": "...", "process_label": "...", "output_label": "..." }
- box_arrow: { "boxes": [ {"id":"b1","label":"...","x":40,"y":70,"w":110,"h":52}, ... ], "arrows": [ {"from":"b1","to":"b2"}, ... ] }
- flowchart: { "nodes": [ {"id":"n1","label":"Start","kind":"rect","x":60,"y":60}, ... ], "edges": [ {"from":"n1","to":"n2"}, ... ] }

For kind "checkpoint" also include checkpoint_question (string), checkpoint_options (array of 3 strings), checkpoint_answer_index (0-based int).
Include at least one checkpoint slide and end with a recap slide (kind recap, diagram_type generic with bullets)."""

    user = f"""Day {day_number}: {day_title}
Activity mode: {activity_type}
Main topic: {topic}
{sub_block}
Build the JSON lesson now."""

    result = llm_service._call(system, user, response_format="json_object", temperature=0.35)
    if not result or not isinstance(result, dict):
        return None
    return sanitize_llm_manifest(
        result,
        day_id=day_id,
        day_number=day_number,
        day_title=day_title,
        activity_type=activity_type,
        topic=topic,
        subtopics=subtopics,
    )


def manifest_for_day_topic(
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
    subtopics: list[str] | None,
    stored: dict[str, Any] | None,
) -> dict[str, Any]:
    """Prefer stored LLM manifest if valid; else catalog."""
    if stored and isinstance(stored, dict) and stored.get("slides"):
        copy_stored = copy.deepcopy(stored)
        fixed = coerce_stored_manifest(
            copy_stored,
            day_id=day_id,
            day_number=day_number,
            day_title=day_title,
            activity_type=activity_type,
            topic=topic,
        )
        if fixed and isinstance(fixed.get("slides"), list) and len(fixed["slides"]) >= 4:
            return fixed
    return build_visual_lesson_manifest(
        day_id=day_id,
        day_number=day_number,
        day_title=day_title,
        activity_type=activity_type or "study",
        topic=topic,
        subtopics=subtopics,
    )
