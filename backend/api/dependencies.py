"""FastAPI dependencies."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User

SessionDep = Annotated[Session, Depends(get_db)]

ANONYMOUS_EMAIL = "anonymous@ezilearning.local"


def get_anonymous_user(db: SessionDep) -> User:
    """Return the shared anonymous user for open access."""
    user = db.query(User).filter(User.email == ANONYMOUS_EMAIL).first()
    if not user:
        user = User(email=ANONYMOUS_EMAIL, password_hash="", full_name="Guest")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_anonymous_user)]
