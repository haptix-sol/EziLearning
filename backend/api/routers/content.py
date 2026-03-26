"""Content generation router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from services.content_generator import generate_challenges_for_user, generate_questions_for_user

router = APIRouter(prefix="/content", tags=["content"])


@router.post("/generate")
def trigger_generation(current_user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    """Trigger content generation (questions and challenges) for the user."""
    questions = generate_questions_for_user(current_user.id, db, count_per_skill=5)
    challenges = generate_challenges_for_user(current_user.id, db, count=3)
    return {
        "message": "Content generation started",
        "questions_created": len(questions),
        "challenges_created": len(challenges),
    }
