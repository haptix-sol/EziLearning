"""Challenges router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, get_db
from core.animations import match_animation
from core.challenge_topics import normalize_topics
from core.exceptions import NotFoundError
from models import Challenge, DayPlan, Execution, UserChallenge, UserLevelContent
from schemas.content import (
    AnneHintRequest,
    AnneHintResponse,
    ChallengeDetailResponse,
    ChallengeResponse,
)
from services.llm_client import llm_service

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _challenge_to_response(c: Challenge, include_hidden: bool = False) -> ChallengeResponse | ChallengeDetailResponse:
    # For list view, mask expected_output for hidden test cases
    test_cases = []
    for tc in (c.test_cases or []):
        t = dict(tc)
        if not include_hidden and t.get("is_hidden"):
            t["expected_output"] = "***"
        test_cases.append(t)
    anim_file = match_animation(c.required_skills, c.title)
    raw_topics = list(c.topics) if getattr(c, "topics", None) else []
    data = {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "difficulty": c.difficulty,
        "language": c.language,
        "starter_code": c.starter_code,
        "test_cases": test_cases,
        "required_skills": c.required_skills or [],
        "topics": normalize_topics(raw_topics) if raw_topics else [],
        "time_limit_seconds": c.time_limit_seconds,
        "created_at": c.created_at,
        "animation_url": f"/animations/{anim_file}" if anim_file else None,
    }
    return ChallengeDetailResponse(**data) if include_hidden else ChallengeResponse(**data)


@router.get("", response_model=list[ChallengeResponse])
def list_challenges(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    difficulty: str | None = Query(None),
    skill: str | None = Query(None),
    topic: str | None = Query(None, description="Topic slug, e.g. arrays, linked-list, streams"),
    language: str | None = Query(None, description="Challenge programming language, e.g. python, java"),
) -> list[ChallengeResponse]:
    """List challenges, optionally filtered by difficulty, skill, topic, or language."""
    q = db.query(Challenge)
    if difficulty:
        q = q.filter(Challenge.difficulty == difficulty)
    if language:
        q = q.filter(Challenge.language == language.strip().lower())
    challenges = q.order_by(Challenge.created_at.desc()).limit(80).all()
    if skill:
        challenges = [c for c in challenges if c.required_skills and skill in c.required_skills]
    if topic and topic.strip().lower() not in ("", "all"):
        slug = topic.strip().lower()
        filtered: list[Challenge] = []
        for c in challenges:
            tops = normalize_topics(list(getattr(c, "topics", None) or []))
            if slug in tops:
                filtered.append(c)
        challenges = filtered
    return [_challenge_to_response(c) for c in challenges]


@router.post("/reset")
def reset_challenges_catalog(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> dict:
    """Remove all coding challenges (global catalog) and clear dangling references.

    Use this when generated problems mismatch the language (e.g. Java wording with Python runner),
    then re-run content generation from your profile or resume.
    """
    db.execute(update(Execution).where(Execution.challenge_id.isnot(None)).values(challenge_id=None))
    db.execute(update(DayPlan).where(DayPlan.challenge_id.isnot(None)).values(challenge_id=None))
    db.execute(delete(UserLevelContent).where(UserLevelContent.content_type == "challenge"))
    db.execute(delete(UserChallenge))
    deleted = db.query(Challenge).count()
    db.query(Challenge).delete(synchronize_session=False)
    db.commit()
    return {
        "deleted": deleted,
        "message": "All challenges were removed. Generate new ones from the dashboard (resume / profile) or content endpoint.",
    }


@router.get("/{challenge_id}", response_model=ChallengeDetailResponse)
def get_challenge(
    challenge_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ChallengeDetailResponse:
    """Get challenge detail with full test cases for execution."""
    c = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not c:
        raise NotFoundError("Challenge not found")
    return _challenge_to_response(c, include_hidden=True)


def _visible_example_tests(c: Challenge) -> list[dict]:
    out: list[dict] = []
    for tc in c.test_cases or []:
        t = dict(tc)
        if t.get("is_hidden"):
            continue
        out.append({"input": t.get("input", ""), "expected_output": t.get("expected_output", "")})
    return out


@router.post("/{challenge_id}/anne-hint", response_model=AnneHintResponse)
def anne_coding_hint(
    challenge_id: str,
    body: AnneHintRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> AnneHintResponse:
    """Tutor Anne: pedagogical hints for the coding challenge (LLM when configured, else friendly fallback)."""
    c = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not c:
        raise NotFoundError("Challenge not found")

    visible = _visible_example_tests(c)
    result = llm_service.anne_coding_hint(
        title=c.title,
        description=c.description or "",
        language=c.language or "python",
        difficulty=c.difficulty,
        visible_examples=visible,
        code_excerpt=body.code_excerpt,
        stderr_excerpt=body.stderr_excerpt,
        test_failure_summary=body.test_failure_summary,
        student_message=body.student_message,
        hint_style=body.hint_style,
    )
    if result and result.get("reply"):
        return AnneHintResponse(reply=str(result["reply"]), fallback=False)

    reason = llm_service.last_failure_reason or "LLM returned no reply."
    fb = (
        f"Hi — I'm Anne. I can't reach the smart tutor engine right now ({reason}). "
        "Here are quick steps that often unblock people: "
        "(1) Re-read the public examples and trace one by hand. "
        "(2) Print or log intermediate values for the smallest failing input. "
        "(3) Check edge cases: empty input, single element, duplicates, max size. "
        "(4) Confirm return type and formatting match the statement exactly. "
        "When an LLM is configured on the server, I'll tailor hints to your code."
    )
    return AnneHintResponse(reply=fb, fallback=True)
