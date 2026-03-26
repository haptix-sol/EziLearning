"""MCQs for study days."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class DayMcq(Base):
    __tablename__ = "day_mcqs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    day_plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("day_plans.id", ondelete="CASCADE"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)  # [{id, text, is_correct}]
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class UserMcqAnswer(Base):
    __tablename__ = "user_mcq_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mcq_id: Mapped[str] = mapped_column(String(36), ForeignKey("day_mcqs.id", ondelete="CASCADE"), nullable=False)
    selected_option_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
