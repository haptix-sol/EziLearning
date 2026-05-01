"""Progress router."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from models import Execution, UserQuestionAnswer
from schemas.progress import ProgressResponse
from services.level_service import count_distinct_challenges_passed

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressResponse)
def get_progress(current_user: CurrentUser, db: Session = Depends(get_db)) -> ProgressResponse:
    """Get user progress summary."""
    # Only full solves count: Submit with test_results and every case passed (distinct challenges).
    challenges_completed = count_distinct_challenges_passed(current_user.id, db)
    questions_answered = db.query(UserQuestionAnswer).filter(
        UserQuestionAnswer.user_id == current_user.id,
    ).count()
    total_time = db.query(func.coalesce(func.sum(Execution.execution_time_ms), 0)).filter(
        Execution.user_id == current_user.id,
    ).scalar() or 0
    total_time_minutes = total_time // 60000
    return ProgressResponse(
        challenges_completed=challenges_completed,
        questions_answered=questions_answered,
        total_time_minutes=total_time_minutes,
        skills_strength=None,
    )
