"""Job application tracking."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str] = mapped_column(String(20), default="private")  # private | government
    source: Mapped[str] = mapped_column(String(50), default="manual")  # manual, linkedin, naukri, ssc, upsc, etc.
    status: Mapped[str] = mapped_column(String(50), default="applied")  # applied, screening, interview, offered, rejected
    applied_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # when user got notification
    notification_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # status_update, new_opening, viewed, etc.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Platform job ID for role mapping
    status_updates: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{date, status, message, email_id}]
    company_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {website, industry, size, location}
    government_portal: Mapped[str | None] = mapped_column(String(100), nullable=True)  # SSC, UPSC, State PSC, etc.
    portal_credentials: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {username, password_enc} - encrypted
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
