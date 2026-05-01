"""Schemas for Daily Lesson Visual Explainer API."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class VisualLessonProgressIn(BaseModel):
    topic_key: str = Field(..., min_length=1, max_length=512)
    last_slide_index: int = Field(0, ge=0)
    completed_lesson: bool = False
    viewed_slide_ids: list[str] | None = None


class VisualLessonProgressOut(BaseModel):
    topic_key: str
    last_slide_index: int
    completed: bool
    xp_awarded: int = 0


class DayVisualTopicState(BaseModel):
    completed: bool
    last_slide_index: int
    has_generated: bool = False
