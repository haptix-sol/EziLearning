"""Onboarding and goal setting."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError, ValidationError
from models import UserGoal, UserKnownTopic, TrendingRole, UserProfile, StudyPlan, DayPlan, DayPlanCompletion
from services.study_generator import create_study_plan

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class SetGoalRequest(BaseModel):
    goal_type: str = Field(..., alias="goalType")  # manual, trending, resume
    goal_text: str | None = Field(None, alias="goalText")
    target_role_id: str | None = Field(None, alias="targetRoleId")
    resume_id: str | None = Field(None, alias="resumeId")
    duration_days: int | None = Field(None, alias="durationDays")  # 7, 14, 30

    model_config = {"extra": "ignore", "populate_by_name": True}  # Accept snake_case or camelCase

    @field_validator("duration_days", mode="before")
    @classmethod
    def coerce_duration_days(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return int(v.strip())
            except ValueError:
                return None
        return v

    @field_validator("goal_type", mode="before")
    @classmethod
    def coerce_goal_type(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            raise ValueError("goal_type is required")
        return str(v).strip().lower() if isinstance(v, str) else v


@router.get("/status")
def get_onboarding_status(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Check if user has completed onboarding (has a goal set)."""
    goal = db.query(UserGoal).filter(UserGoal.user_id == current_user.id).order_by(UserGoal.created_at.desc()).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    return {
        "has_goal": goal is not None,
        "has_profile": profile is not None,
        "goal": {
            "goal_type": goal.goal_type,
            "goal_text": goal.goal_text,
            "target_role_id": goal.target_role_id,
        } if goal else None,
    }


@router.post("/goal")
def set_goal(
    current_user: CurrentUser,
    data: SetGoalRequest,
    db: Session = Depends(get_db),
):
    """Set user's learning goal. If duration_days (7, 14, 30) provided for manual/trending, creates study plan."""
    study_plan_id = None
    duration_days = None
    if data.duration_days and data.duration_days in (7, 14, 30) and data.goal_type in ("manual", "trending"):
        try:
            plan = create_study_plan(current_user.id, data.duration_days, data.goal_text, db)
            study_plan_id = plan.id
            duration_days = data.duration_days
        except ValueError as e:
            raise ValidationError(str(e))
    goal = UserGoal(
        user_id=current_user.id,
        goal_type=data.goal_type,
        goal_text=data.goal_text,
        target_role_id=data.target_role_id,
        resume_id=data.resume_id,
        study_plan_id=study_plan_id,
        duration_days=duration_days,
    )
    db.add(goal)
    db.commit()
    return {"message": "Goal set", "goal_id": goal.id, "study_plan_id": study_plan_id}


@router.get("/goals")
def list_goals(current_user: CurrentUser, db: Session = Depends(get_db)):
    """List user's goals with study plan info (for My Goals / adventure map)."""
    goals = db.query(UserGoal).filter(UserGoal.user_id == current_user.id).order_by(UserGoal.created_at.desc()).limit(20).all()
    result = []
    for g in goals:
        completed_days = 0
        total_days = g.duration_days or 0
        if g.study_plan_id:
            completed_days = db.query(DayPlanCompletion).join(DayPlan).filter(
                DayPlan.study_plan_id == g.study_plan_id,
                DayPlanCompletion.user_id == current_user.id,
            ).count()
        role = db.query(TrendingRole).filter(TrendingRole.id == g.target_role_id).first() if g.target_role_id else None
        goal_label = g.goal_text or (role.name if role else "Goal")
        result.append({
            "id": g.id,
            "goal_type": g.goal_type,
            "goal_text": g.goal_text,
            "goal_label": goal_label or "My Goal",
            "target_role_id": g.target_role_id,
            "study_plan_id": g.study_plan_id,
            "duration_days": g.duration_days,
            "completed_days": completed_days,
            "total_days": total_days,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return result


@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: str, current_user: CurrentUser, db: Session = Depends(get_db)):
    """Delete a goal. Also deletes its linked study plan and per-goal roadmap progress."""
    goal = db.query(UserGoal).filter(
        UserGoal.id == goal_id,
        UserGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise NotFoundError("Goal not found")
    study_plan_id = goal.study_plan_id
    if study_plan_id:
        plan = db.query(StudyPlan).filter(
            StudyPlan.id == study_plan_id,
            StudyPlan.user_id == current_user.id,
        ).first()
        if plan:
            db.delete(plan)
    db.query(UserKnownTopic).filter(
        UserKnownTopic.user_id == current_user.id,
        UserKnownTopic.goal_id == goal_id,
    ).delete(synchronize_session=False)
    db.delete(goal)
    db.commit()
    return {"message": "Deleted", "goal_id": goal_id}


@router.get("/trending")
def get_trending_roles(db: Session = Depends(get_db)):
    """List trending roles/skills for selection."""
    roles = db.query(TrendingRole).order_by(TrendingRole.popularity_score.desc().nullslast()).limit(30).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "skills": r.skills or [],
        }
        for r in roles
    ]
