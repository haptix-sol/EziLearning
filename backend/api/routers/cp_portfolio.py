"""Competitive programming portfolio: linked accounts, verification, sync, public page."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, get_db
from core.exceptions import NotFoundError, ValidationError
from models import User, UserProfile
from models.cp_portfolio import CpPlatformConnection, CpPortfolioSettings
from services import cp_platform_sync as cp_sync

router = APIRouter(prefix="/cp", tags=["cp-portfolio"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _settings_for(db: Session, user_id: str) -> CpPortfolioSettings:
    row = db.query(CpPortfolioSettings).filter(CpPortfolioSettings.user_id == user_id).first()
    if not row:
        row = CpPortfolioSettings(user_id=user_id, public_slug=None, public_enabled=False)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


class CpSettingsOut(BaseModel):
    public_slug: str | None
    public_enabled: bool
    headline: str | None


class CpSettingsUpdate(BaseModel):
    public_slug: str | None = None
    public_enabled: bool | None = None
    headline: str | None = Field(None, max_length=280)


class ConnectionCreate(BaseModel):
    platform: str
    handle: str = Field(..., min_length=1, max_length=128)


class ConnectionOut(BaseModel):
    id: str
    platform: str
    handle: str
    verification_status: str
    verified_at: datetime | None
    last_sync_at: datetime | None
    last_sync_error: str | None
    stats_json: dict | None
    verify_phrase: str | None = None


class UnifiedPrivateOut(BaseModel):
    settings: CpSettingsOut
    connections: list[ConnectionOut]
    display_name: str | None


class UnifiedPublicOut(BaseModel):
    slug: str
    headline: str | None
    display_name: str | None
    platforms: list[dict]


def _conn_to_out(c: CpPlatformConnection, include_phrase: bool) -> ConnectionOut:
    phrase = cp_sync.verify_phrase(c.verify_token) if include_phrase and not c.verified_at else None
    return ConnectionOut(
        id=c.id,
        platform=c.platform,
        handle=c.handle,
        verification_status=c.verification_status,
        verified_at=c.verified_at,
        last_sync_at=c.last_sync_at,
        last_sync_error=c.last_sync_error,
        stats_json=c.stats_json,
        verify_phrase=phrase,
    )


@router.get("/me/settings", response_model=CpSettingsOut)
def get_cp_settings(current_user: CurrentUser, db: Session = Depends(get_db)):
    s = _settings_for(db, current_user.id)
    return CpSettingsOut(public_slug=s.public_slug, public_enabled=s.public_enabled, headline=s.headline)


@router.put("/me/settings", response_model=CpSettingsOut)
def update_cp_settings(
    body: CpSettingsUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    s = _settings_for(db, current_user.id)
    if body.public_slug is not None:
        raw = (body.public_slug or "").strip()
        if not raw:
            s.public_slug = None
        else:
            ok, msg_or_slug = cp_sync.validate_public_slug(raw)
            if not ok:
                raise ValidationError(msg_or_slug)
            other = (
                db.query(CpPortfolioSettings)
                .filter(
                    CpPortfolioSettings.public_slug == msg_or_slug,
                    CpPortfolioSettings.user_id != current_user.id,
                )
                .first()
            )
            if other:
                raise ValidationError("That public URL is already taken.")
            s.public_slug = msg_or_slug
    if body.public_enabled is not None:
        s.public_enabled = bool(body.public_enabled)
        if s.public_enabled and not (s.public_slug or "").strip():
            raise ValidationError("Set a public slug before enabling your public CP page.")
    if body.headline is not None:
        h = (body.headline or "").strip()
        s.headline = h or None
    db.commit()
    db.refresh(s)
    return CpSettingsOut(public_slug=s.public_slug, public_enabled=s.public_enabled, headline=s.headline)


@router.get("/me/connections", response_model=list[ConnectionOut])
def list_connections(current_user: CurrentUser, db: Session = Depends(get_db)):
    rows = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.user_id == current_user.id)
        .order_by(CpPlatformConnection.created_at.asc())
        .all()
    )
    return [_conn_to_out(c, include_phrase=True) for c in rows]


@router.post("/me/connections", response_model=ConnectionOut)
def add_connection(
    body: ConnectionCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    plat = body.platform.strip().lower()
    if plat not in cp_sync.ALLOWED_PLATFORMS:
        raise ValidationError(f"Unsupported platform. Choose one of: {', '.join(sorted(cp_sync.ALLOWED_PLATFORMS))}.")
    handle = cp_sync.normalize_platform_handle(plat, body.handle)
    if not handle:
        raise ValidationError("Handle is required.")
    existing = (
        db.query(CpPlatformConnection)
        .filter(
            CpPlatformConnection.user_id == current_user.id,
            CpPlatformConnection.platform == plat,
        )
        .first()
    )
    token = cp_sync.new_verify_token()
    if existing:
        existing.handle = handle
        existing.verify_token = token
        existing.verified_at = None
        existing.verification_status = "pending"
        existing.last_sync_error = None
        existing.stats_json = None
        existing.last_sync_at = None
        db.commit()
        db.refresh(existing)
        return _conn_to_out(existing, include_phrase=True)
    row = CpPlatformConnection(
        user_id=current_user.id,
        platform=plat,
        handle=handle,
        verify_token=token,
        verification_status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _conn_to_out(row, include_phrase=True)


@router.delete("/me/connections/{connection_id}")
def delete_connection(
    connection_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    row = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.id == connection_id, CpPlatformConnection.user_id == current_user.id)
        .first()
    )
    if not row:
        raise NotFoundError("Connection not found.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/me/connections/{connection_id}/regenerate-token", response_model=ConnectionOut)
def regenerate_token(
    connection_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    row = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.id == connection_id, CpPlatformConnection.user_id == current_user.id)
        .first()
    )
    if not row:
        raise NotFoundError("Connection not found.")
    row.verify_token = cp_sync.new_verify_token()
    row.verified_at = None
    row.verification_status = "pending"
    db.commit()
    db.refresh(row)
    return _conn_to_out(row, include_phrase=True)


@router.post("/me/connections/{connection_id}/verify", response_model=ConnectionOut)
def verify_connection(
    connection_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    row = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.id == connection_id, CpPlatformConnection.user_id == current_user.id)
        .first()
    )
    if not row:
        raise NotFoundError("Connection not found.")
    normalized = cp_sync.normalize_platform_handle(row.platform, row.handle)
    if normalized != row.handle:
        row.handle = normalized
    ok, msg = cp_sync.verify_connection(row.platform, row.handle, row.verify_token)
    if ok:
        row.verified_at = _utcnow()
        row.verification_status = "verified"
    else:
        row.verification_status = "failed"
    row.last_sync_error = None if ok else msg
    db.commit()
    db.refresh(row)
    return _conn_to_out(row, include_phrase=True)


@router.post("/me/connections/{connection_id}/sync", response_model=ConnectionOut)
def sync_connection(
    connection_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    row = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.id == connection_id, CpPlatformConnection.user_id == current_user.id)
        .first()
    )
    if not row:
        raise NotFoundError("Connection not found.")
    if not row.verified_at:
        raise ValidationError("Verify this connection before syncing stats.")
    normalized = cp_sync.normalize_platform_handle(row.platform, row.handle)
    if normalized != row.handle:
        row.handle = normalized
    stats, err = cp_sync.sync_platform_stats(row.platform, row.handle)
    row.last_sync_at = _utcnow()
    if err:
        row.last_sync_error = err
    else:
        row.last_sync_error = None
        row.stats_json = stats
    db.commit()
    db.refresh(row)
    return _conn_to_out(row, include_phrase=True)


@router.get("/me/unified", response_model=UnifiedPrivateOut)
def unified_private(current_user: CurrentUser, db: Session = Depends(get_db)):
    s = _settings_for(db, current_user.id)
    rows = (
        db.query(CpPlatformConnection)
        .filter(CpPlatformConnection.user_id == current_user.id)
        .order_by(CpPlatformConnection.created_at.asc())
        .all()
    )
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    display = profile.full_name if profile and profile.full_name else current_user.full_name
    return UnifiedPrivateOut(
        settings=CpSettingsOut(public_slug=s.public_slug, public_enabled=s.public_enabled, headline=s.headline),
        connections=[_conn_to_out(c, include_phrase=True) for c in rows],
        display_name=display,
    )


@router.get("/public/{slug}", response_model=UnifiedPublicOut)
def public_cp_page(slug: str, db: Session = Depends(get_db)):
    raw = slug.strip().lower()
    ok, normalized = cp_sync.validate_public_slug(raw)
    if not ok:
        raise NotFoundError("Profile not found.")
    s = db.query(CpPortfolioSettings).filter(CpPortfolioSettings.public_slug == normalized).first()
    if not s or not s.public_enabled:
        raise NotFoundError("Profile not found.")
    rows = (
        db.query(CpPlatformConnection)
        .filter(
            CpPlatformConnection.user_id == s.user_id,
            CpPlatformConnection.verified_at.isnot(None),
        )
        .order_by(CpPlatformConnection.created_at.asc())
        .all()
    )
    user = db.get(User, s.user_id)
    profile = db.query(UserProfile).filter(UserProfile.user_id == s.user_id).first()
    display = None
    if profile and profile.full_name:
        display = profile.full_name
    elif user and user.full_name:
        display = user.full_name
    platforms = []
    for c in rows:
        platforms.append(
            {
                "platform": c.platform,
                "handle": c.handle,
                "stats": c.stats_json,
            }
        )
    return UnifiedPublicOut(
        slug=normalized,
        headline=s.headline,
        display_name=display,
        platforms=platforms,
    )
