"""Study plans, roadmap, levels."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)  # 7, 14, 30
    plan_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 1_week, 2_weeks, 1_month
    focus_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StudyLevel(Base):
    __tablename__ = "study_levels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    study_plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class DayPlan(Base):
    __tablename__ = "day_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    study_plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False)
    level_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("study_levels.id", ondelete="SET NULL"), nullable=True)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    topics: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["Topic 1", "Topic 2"] or [{"name": str, "subtopics": [str]}]
    subtopics: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"Topic 1": ["Sub1", "Sub2"]} - optional
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    activity_type: Mapped[str] = mapped_column(String(30), default="study")  # read, study, practice, test
    challenge_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True)  # coding required
    level: Mapped[int] = mapped_column(Integer, default=1)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DayPlanCompletion(Base):
    __tablename__ = "day_plan_completions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day_plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("day_plans.id", ondelete="CASCADE"), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    xp_earned: Mapped[int] = mapped_column(Integer, default=10)


class VisualLessonTopicProgress(Base):
    """Per-user progress for Daily Lesson Visual Explainer (per day + topic slug)."""

    __tablename__ = "visual_lesson_topic_progress"
    __table_args__ = (UniqueConstraint("user_id", "day_plan_id", "topic_key", name="uq_visual_lesson_topic"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day_plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("day_plans.id", ondelete="CASCADE"), nullable=False)
    topic_key: Mapped[str] = mapped_column(String(512), nullable=False)
    last_slide_index: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    viewed_slide_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    #: LLM-built manifest for this day+topic; when set, GET visual-lesson returns this instead of catalog.
    generated_manifest: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class UserLevel(Base):
    __tablename__ = "user_levels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    xp_to_next_level: Mapped[int] = mapped_column(Integer, default=100)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
