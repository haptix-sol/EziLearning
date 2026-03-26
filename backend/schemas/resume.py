"""Resume and profile schemas."""
from datetime import datetime
from pydantic import BaseModel


class ResumeSkillResponse(BaseModel):
    skill_name: str
    category: str | None
    confidence: float | None


class UserProfileResponse(BaseModel):
    id: str
    full_name: str | None
    email: str | None
    phone: str | None
    experience_level: str | None
    years_experience: int | None
    target_role: str | None
    target_industry: str | None
    education_summary: str | None
    professional_summary: str | None
    avatar_url: str | None = None
    skills: list[ResumeSkillResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    experience_level: str | None = None
    years_experience: int | None = None
    target_role: str | None = None
    target_industry: str | None = None


class ResumeResponse(BaseModel):
    id: str
    file_name: str | None
    file_type: str | None
    created_at: datetime
    profile: UserProfileResponse | None = None

    class Config:
        from_attributes = True
