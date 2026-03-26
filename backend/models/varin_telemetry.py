"""Append-only events for Varin (Rust engine) renders — used for trends, bugs, and improvement loops."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class VarinRenderEvent(Base):
    """One row per render attempt, merge step, or LLM validation failure."""

    __tablename__ = "varin_render_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    video_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_style: Mapped[str | None] = mapped_column(String(32), nullable=True)
    segment_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scene_name: Mapped[str | None] = mapped_column(String(64), nullable=True)

    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_category: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
