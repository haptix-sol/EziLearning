"""Job application tracking."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError
from core.credentials import decrypt_password, encrypt_password
from models import JobApplication

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    company: str
    role: str
    sector: str = "private"  # private | government
    source: str = "manual"
    status: str = "applied"
    notes: str | None = None
    applied_date: datetime | None = None
    notification_date: datetime | None = None
    notification_type: str | None = None
    company_details: dict | None = None  # {website, industry, size, location}
    government_portal: str | None = None  # SSC, UPSC, etc.
    portal_username: str | None = None
    portal_password: str | None = None


class JobUpdate(BaseModel):
    company: str | None = None
    role: str | None = None
    sector: str | None = None
    status: str | None = None
    notes: str | None = None
    applied_date: datetime | None = None
    notification_date: datetime | None = None
    notification_type: str | None = None
    company_details: dict | None = None
    government_portal: str | None = None
    portal_username: str | None = None
    portal_password: str | None = None


class JobStatusUpdate(BaseModel):
    date: str
    status: str
    message: str | None = None
    email_id: str | None = None


class JobResponse(BaseModel):
    id: str
    company: str
    role: str
    sector: str
    source: str
    status: str
    applied_date: datetime | None
    notification_date: datetime | None
    notification_type: str | None
    notes: str | None
    external_id: str | None
    status_updates: list[JobStatusUpdate] | None
    company_details: dict | None
    government_portal: str | None
    portal_username: str | None
    portal_password_masked: bool = False  # True if password stored
    last_synced_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


def _job_to_response(j: JobApplication) -> JobResponse:
    creds = j.portal_credentials or {}
    return JobResponse(
        id=j.id,
        company=j.company,
        role=j.role,
        sector=getattr(j, "sector", None) or "private",
        source=j.source,
        status=j.status,
        applied_date=j.applied_date,
        notification_date=getattr(j, "notification_date", None),
        notification_type=getattr(j, "notification_type", None),
        notes=j.notes,
        external_id=j.external_id,
        status_updates=[JobStatusUpdate.model_validate(u) for u in (j.status_updates or [])] if j.status_updates else None,
        company_details=getattr(j, "company_details", None),
        government_portal=getattr(j, "government_portal", None),
        portal_username=creds.get("username") if creds else None,
        portal_password_masked=bool(creds.get("password")),
        last_synced_at=j.last_synced_at,
        created_at=j.created_at,
    )


@router.get("", response_model=list[JobResponse])
def list_jobs(current_user: CurrentUser, db: Session = Depends(get_db)):
    """List all job applications."""
    jobs = db.query(JobApplication).filter(JobApplication.user_id == current_user.id).order_by(JobApplication.created_at.desc()).all()
    return [_job_to_response(j) for j in jobs]


@router.get("/{job_id}/credentials")
def get_job_credentials(job_id: str, current_user: CurrentUser, db: Session = Depends(get_db)):
    """Get decrypted portal credentials for a government job. Use sparingly."""
    job = db.query(JobApplication).filter(
        JobApplication.id == job_id,
        JobApplication.user_id == current_user.id,
    ).first()
    if not job:
        raise NotFoundError("Job not found")
    creds = job.portal_credentials or {}
    password_enc = creds.get("password")
    password = decrypt_password(password_enc) if password_enc else None
    return {"username": creds.get("username"), "password": password}


@router.post("", response_model=JobResponse)
def create_job(current_user: CurrentUser, data: JobCreate, db: Session = Depends(get_db)):
    """Add a job application (manual entry)."""
    portal_creds = None
    if data.portal_username or data.portal_password:
        portal_creds = {"username": data.portal_username}
        if data.portal_password:
            portal_creds["password"] = encrypt_password(data.portal_password)
    job = JobApplication(
        user_id=current_user.id,
        company=data.company,
        role=data.role,
        sector=data.sector,
        source=data.source,
        status=data.status,
        notes=data.notes,
        applied_date=data.applied_date or datetime.now(timezone.utc),
        notification_date=data.notification_date,
        notification_type=data.notification_type,
        company_details=data.company_details,
        government_portal=data.government_portal,
        portal_credentials=portal_creds,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.patch("/{job_id}", response_model=JobResponse)
def update_job(job_id: str, current_user: CurrentUser, data: JobUpdate, db: Session = Depends(get_db)):
    """Update job application."""
    job = db.query(JobApplication).filter(
        JobApplication.id == job_id,
        JobApplication.user_id == current_user.id,
    ).first()
    if not job:
        raise NotFoundError("Job not found")
    if data.company is not None:
        job.company = data.company
    if data.role is not None:
        job.role = data.role
    if data.sector is not None:
        job.sector = data.sector
    if data.status is not None:
        job.status = data.status
    if data.notes is not None:
        job.notes = data.notes
    if data.applied_date is not None:
        job.applied_date = data.applied_date
    if data.notification_date is not None:
        job.notification_date = data.notification_date
    if data.notification_type is not None:
        job.notification_type = data.notification_type
    if data.company_details is not None:
        job.company_details = data.company_details
    if data.government_portal is not None:
        job.government_portal = data.government_portal
    if data.portal_username is not None or data.portal_password is not None:
        creds = job.portal_credentials or {}
        if data.portal_username is not None:
            creds["username"] = data.portal_username
        if data.portal_password is not None:
            creds["password"] = encrypt_password(data.portal_password)
        job.portal_credentials = creds
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.delete("/{job_id}")
def delete_job(job_id: str, current_user: CurrentUser, db: Session = Depends(get_db)):
    """Delete a job application."""
    job = db.query(JobApplication).filter(
        JobApplication.id == job_id,
        JobApplication.user_id == current_user.id,
    ).first()
    if not job:
        raise NotFoundError("Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Deleted"}
