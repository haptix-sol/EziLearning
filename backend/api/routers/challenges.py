"""Challenges router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from core.animations import match_animation
from core.exceptions import NotFoundError
from models import Challenge, UserProfile
from schemas.content import ChallengeDetailResponse, ChallengeResponse

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
    data = {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "difficulty": c.difficulty,
        "language": c.language,
        "starter_code": c.starter_code,
        "test_cases": test_cases,
        "required_skills": c.required_skills or [],
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
) -> list[ChallengeResponse]:
    """List challenges, optionally filtered by user profile."""
    q = db.query(Challenge)
    if difficulty:
        q = q.filter(Challenge.difficulty == difficulty)
    challenges = q.order_by(Challenge.created_at.desc()).limit(50).all()
    if skill:
        challenges = [c for c in challenges if c.required_skills and skill in c.required_skills]
    return [_challenge_to_response(c) for c in challenges]


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
