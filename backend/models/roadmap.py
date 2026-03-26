"""Roadmap topics and user known topics."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class RoadmapTopic(Base):
    __tablename__ = "roadmap_topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("roadmap_topics.id"), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RoadmapTopicEdge(Base):
    __tablename__ = "roadmap_topic_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    from_topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("roadmap_topics.id", ondelete="CASCADE"), nullable=False)
    to_topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("roadmap_topics.id", ondelete="CASCADE"), nullable=False)


class UserKnownTopic(Base):
    __tablename__ = "user_known_topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("roadmap_topics.id", ondelete="CASCADE"), nullable=False)
    goal_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("user_goals.id", ondelete="CASCADE"), nullable=True
    )  # when set, roadmap progress is per-goal
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
