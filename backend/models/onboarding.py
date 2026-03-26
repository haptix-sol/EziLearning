"""Onboarding and user goals."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class UserGoal(Base):
    __tablename__ = "user_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_type: Mapped[str] = mapped_column(String(20), nullable=False)  # manual, trending, resume
    goal_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_role_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    resume_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    study_plan_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=True
    )  # linked study plan; deleting plan deletes this goal
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 7, 14, 30
    skill_gap: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{topic_id, priority}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class TrendingRole(Base):
    __tablename__ = "trending_roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["React", "TypeScript"]
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    popularity_score: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
