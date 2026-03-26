"""Resumes router: upload, get parsed data, profile, avatar."""
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from core.config import settings
from core.exceptions import ValidationError
from models import Resume, User, UserProfile
from schemas.resume import ProfileUpdateRequest, ResumeResponse, ResumeSkillResponse, UserProfileResponse
from services.resume_parser import process_resume

router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/upload")
def upload_resume(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Upload and process resume."""
    content = file.file.read()
    try:
        resume, profile = process_resume(
            user_id=current_user.id,
            file_content=content,
            file_name=file.filename or "resume",
            file_type=file.content_type or "application/pdf",
            db=db,
        )
    except ValueError as e:
        raise ValidationError(str(e))
    return {"message": "Resume processed successfully", "resume_id": resume.id, "profile_id": profile.id}


@router.get("/profile", response_model=UserProfileResponse | None)
def get_my_profile(current_user: CurrentUser, db: Session = Depends(get_db)) -> UserProfileResponse | None:
    """Get current user's profile (resume-derived)."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        return None
    skills = [ResumeSkillResponse(skill_name=s.skill_name, category=s.category, confidence=s.confidence) for s in profile.skills]
    avatar_url = f"/avatars/{profile.avatar_url}" if profile.avatar_url else None
    return UserProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        experience_level=profile.experience_level,
        years_experience=profile.years_experience,
        target_role=profile.target_role,
        target_industry=profile.target_industry,
        education_summary=profile.education_summary,
        professional_summary=profile.professional_summary,
        avatar_url=avatar_url,
        skills=skills,
        created_at=profile.created_at,
    )


@router.get("/me", response_model=ResumeResponse | None)
def get_my_resume(current_user: CurrentUser, db: Session = Depends(get_db)) -> ResumeResponse | None:
    """Get current user's latest resume and profile."""
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).order_by(Resume.created_at.desc()).first()
    if not resume:
        return None
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    skills = [ResumeSkillResponse(skill_name=s.skill_name, category=s.category, confidence=s.confidence) for s in profile.skills] if profile else []
    return ResumeResponse(
        id=resume.id,
        file_name=resume.file_name,
        file_type=resume.file_type,
        created_at=resume.created_at,
        profile=UserProfileResponse(
            id=profile.id,
            full_name=profile.full_name,
            email=profile.email,
            phone=profile.phone,
            experience_level=profile.experience_level,
            years_experience=profile.years_experience,
            target_role=profile.target_role,
            target_industry=profile.target_industry,
            education_summary=profile.education_summary,
            professional_summary=profile.professional_summary,
            skills=skills,
            created_at=profile.created_at,
        ) if profile else None,
    )


@router.get("/me-display")
def get_me_display(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Lightweight user display for header: name, avatar, email."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    return {
        "full_name": (profile.full_name if profile else None) or current_user.full_name or "Guest",
        "email": (profile.email if profile else None) or current_user.email,
        "avatar_url": f"/avatars/{profile.avatar_url}" if profile and profile.avatar_url else None,
    }


@router.post("/avatar")
def upload_avatar(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload profile picture. Accepts JPEG, PNG, WebP, GIF."""
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise ValidationError("Invalid file type. Use JPEG, PNG, WebP, or GIF.")
    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise ValidationError("File too large. Max 5MB.")
    ext = ".jpg" if "jpeg" in (file.content_type or "") or "jpg" in (file.content_type or "") else ".png"
    if "webp" in (file.content_type or ""):
        ext = ".webp"
    if "gif" in (file.content_type or ""):
        ext = ".gif"
    filename = f"{current_user.id}{ext}"
    avatars_dir = Path(settings.avatar_storage_path).resolve()
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filepath = avatars_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()
    profile.avatar_url = filename
    db.commit()
    return {"avatar_url": f"/avatars/{filename}"}


@router.patch("/profile", response_model=UserProfileResponse)
def update_profile(
    current_user: CurrentUser,
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update profile fields. Creates profile if not exists."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()
    if data.full_name is not None:
        profile.full_name = data.full_name
    if data.email is not None:
        profile.email = data.email
    if data.phone is not None:
        profile.phone = data.phone
    if data.experience_level is not None:
        profile.experience_level = data.experience_level
    if data.years_experience is not None:
        profile.years_experience = data.years_experience
    if data.target_role is not None:
        profile.target_role = data.target_role
    if data.target_industry is not None:
        profile.target_industry = data.target_industry
    db.commit()
    db.refresh(profile)
    skills = [ResumeSkillResponse(skill_name=s.skill_name, category=s.category, confidence=s.confidence) for s in profile.skills]
    return UserProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        experience_level=profile.experience_level,
        years_experience=profile.years_experience,
        target_role=profile.target_role,
        target_industry=profile.target_industry,
        education_summary=profile.education_summary,
        professional_summary=profile.professional_summary,
        avatar_url=f"/avatars/{profile.avatar_url}" if profile.avatar_url else None,
        skills=skills,
        created_at=profile.created_at,
    )
