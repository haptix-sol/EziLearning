"""Content schemas: challenges, questions."""
from datetime import datetime
from pydantic import BaseModel


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
    time_limit_seconds: int
    created_at: datetime
    animation_url: str | None = None  # Varin prerender when topic matches (e.g. /animations/binary-search.mp4)

    class Config:
        from_attributes = True


class ChallengeDetailResponse(ChallengeResponse):
    """Full challenge with all test cases for execution."""

    pass


class QuestionResponse(BaseModel):
    id: str
    question_text: str
    answer_text: str | None
    skill_name: str
    difficulty: str | None
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class SubmitAnswerRequest(BaseModel):
    user_answer: str
    request_feedback: bool = False
