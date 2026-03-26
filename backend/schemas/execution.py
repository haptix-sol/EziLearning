"""Execution schemas."""
from datetime import datetime
from pydantic import BaseModel


class ExecuteCodeRequest(BaseModel):
    code: str
    language: str = "python"
    challenge_id: str | None = None
    mode: str = "submit"  # "run" = execute only, "submit" = execute + run test cases


class TestResultItem(BaseModel):
    passed: bool
    input: str | None = None
    expected: str | None = None
    actual: str | None = None


class ExecutionResponse(BaseModel):
    id: str
    status: str
    stdout: str | None
    stderr: str | None
    test_results: list[dict] | None
    execution_time_ms: int | None
    created_at: datetime

    class Config:
        from_attributes = True
