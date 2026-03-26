"""Game-style sequential levels with resume-driven content."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class LevelCompletion(Base):
    """User completed a level - required to unlock next."""
    __tablename__ = "level_completions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    stars: Mapped[int] = mapped_column(Integer, default=3)  # 1-3 stars based on performance


class UserLevelContent(Base):
    """Links user's level to generated challenges/questions (resume-driven)."""
    __tablename__ = "user_level_content"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False)  # challenge, question
    content_id: Mapped[str] = mapped_column(String(36), nullable=False)  # challenge_id or question_id
