"""Generated video tutorials. Video files are stored on local disk (data/videos/);
only the file path is stored in the database, never video binary content."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class GeneratedVideo(Base):
    __tablename__ = "generated_videos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    topic_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)  # Local disk path, set when completed
    caption_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)  # SRT for TTS
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # pending, generating, completed, failed
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    status_message: Mapped[str | None] = mapped_column(String(256), nullable=True)  # e.g. "Segments 3/25", "Generating audio"
    segments_done: Mapped[int | None] = mapped_column(Integer, nullable=True)  # For live progress: 3
    segments_total: Mapped[int | None] = mapped_column(Integer, nullable=True)  # For live progress: 25
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
