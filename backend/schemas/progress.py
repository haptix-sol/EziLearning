"""Progress schemas."""
from pydantic import BaseModel


class ProgressResponse(BaseModel):
    challenges_completed: int
    questions_answered: int
    total_time_minutes: int
    skills_strength: dict | None = None
