"""Base model and database setup."""
from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


def utc_now() -> datetime:
    """Current UTC datetime."""
    return datetime.now(timezone.utc)
