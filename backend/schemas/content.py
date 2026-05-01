"""Content schemas: challenges, questions."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


class ChallengeResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str | None
    language: str
    starter_code: str | None
    test_cases: list[dict]  # Don't expose expected for hidden cases in list view
    required_skills: list[str] | None
    topics: list[str] = []
    time_limit_seconds: int
    created_at: datetime
    animation_url: str | None = None  # e.g. /animations/binary-search.mp4 when topic matches a bundled clip

    class Config:
        from_attributes = True


class ChallengeDetailResponse(ChallengeResponse):
    """Full challenge with all test cases for execution."""

    pass


class QuestionResponse(BaseModel):
    """Full question including reference (internal / admin only — do not use for learner quiz APIs)."""

    id: str
    question_text: str
    answer_text: str | None
    skill_name: str
    difficulty: str | None
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionPublic(BaseModel):
    """Question for learners — no reference answer."""

    id: str
    question_text: str
    skill_name: str
    difficulty: str | None
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class SubmitAnswerRequest(BaseModel):
    user_answer: str


class SubmitAnswerResponse(BaseModel):
    message: str
    verdict: Literal["correct", "partial", "needs_improvement"]
    feedback: str


class AnneHintRequest(BaseModel):
    """Body for Anne (coding tutor) hints — keep excerpts small; server truncates further."""

    student_message: str | None = None
    hint_style: Literal["light", "stuck", "debug"] = "light"
    code_excerpt: str | None = Field(None, max_length=16000)
    stderr_excerpt: str | None = Field(None, max_length=8000)
    test_failure_summary: str | None = Field(None, max_length=4000)


class AnneHintResponse(BaseModel):
    reply: str
    fallback: bool = False
