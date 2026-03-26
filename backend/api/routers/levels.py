"""Game-style level map and sequential progression."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError, ValidationError
from services.level_service import (
    TOTAL_LEVELS,
    get_completed_levels,
    get_current_level,
    is_level_unlocked,
    ensure_level_content,
    complete_level,
)

router = APIRouter(prefix="/levels", tags=["levels"])


class LevelMapItem(BaseModel):
    level_number: int
    completed: bool
    unlocked: bool
    stars: int | None  # 1-3 if completed
    is_current: bool


class LevelContentResponse(BaseModel):
    level_number: int
    challenges: list[dict]
    questions: list[dict]
    all_complete: bool
    can_complete: bool  # same as all_complete for now


@router.get("/map")
def get_level_map(current_user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    """Get level map for game-style UI: levels with completion and unlock status."""
    completed = get_completed_levels(current_user.id, db)
    current = get_current_level(current_user.id, db)

    # Get stars for completed levels
    from models import LevelCompletion
    stars_map = {
        lc.level_number: lc.stars
        for lc in db.query(LevelCompletion).filter(
            LevelCompletion.user_id == current_user.id,
        ).all()
    }

    levels = []
    for n in range(1, TOTAL_LEVELS + 1):
        levels.append(LevelMapItem(
            level_number=n,
            completed=n in completed,
            unlocked=is_level_unlocked(n, completed),
            stars=stars_map.get(n) if n in completed else None,
            is_current=(n == current and n not in completed),
        ))

    return {
        "levels": levels,
        "current_level": current,
        "total_levels": TOTAL_LEVELS,
        "completed_count": len(completed),
    }


@router.get("/{level_number}/content", response_model=LevelContentResponse)
def get_level_content(
    level_number: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Get level content (challenges + questions). Generates via LLM if first access. Requires previous level completed."""
    if level_number < 1 or level_number > TOTAL_LEVELS:
        raise NotFoundError("Level not found")

    completed = get_completed_levels(current_user.id, db)
    if not is_level_unlocked(level_number, completed):
        raise ValidationError("Complete the previous level first to unlock this level.")

    challenges, questions, all_complete = ensure_level_content(
        current_user.id, level_number, db,
    )

    return LevelContentResponse(
        level_number=level_number,
        challenges=challenges,
        questions=questions,
        all_complete=all_complete,
        can_complete=all_complete,
    )


@router.post("/{level_number}/complete")
def complete_level_endpoint(
    level_number: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Mark level as complete. Only succeeds when all challenges passed and questions answered."""
    if level_number < 1 or level_number > TOTAL_LEVELS:
        raise NotFoundError("Level not found")

    result = complete_level(current_user.id, level_number, db)
    if not result:
        raise ValidationError("Complete all challenges and answer all questions to finish this level.")

    return result
