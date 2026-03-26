"""Gmail OAuth and job sync."""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, get_db
from core.config import settings
from core.exceptions import ValidationError
from models import GmailOAuthToken

router = APIRouter(prefix="/gmail", tags=["gmail"])

# In-memory cache: state -> (user_id, code_verifier). PKCE requires code_verifier at token exchange.
_oauth_state_cache: dict[str, tuple[str, str]] = {}


def _get_flow():
    """Create OAuth flow. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise ValidationError(
            "Gmail integration not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env. "
            "Create credentials at https://console.cloud.google.com/apis/credentials"
        )
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri],
            }
        },
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
        redirect_uri=settings.google_redirect_uri,
    )


@router.get("/connect")
def connect_gmail(current_user: CurrentUser):
    """Redirect to Google OAuth. User authorizes Gmail read access."""
    flow = _get_flow()
    state = secrets.token_urlsafe(32)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )
    code_verifier = getattr(flow, "code_verifier", None) or ""
    _oauth_state_cache[state] = (current_user.id, code_verifier)
    return RedirectResponse(url=auth_url)


@router.get("/callback")
def gmail_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """OAuth callback. Exchange code for tokens, store, redirect to frontend."""
    frontend = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    if error:
        return RedirectResponse(url=f"{frontend}/jobs?gmail_error={error}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend}/jobs?gmail_error=missing_code_or_state")
    cached = _oauth_state_cache.pop(state, None)
    if not cached:
        return RedirectResponse(url=f"{frontend}/jobs?gmail_error=invalid_state")
    user_id, code_verifier = cached
    flow = _get_flow()
    flow.fetch_token(code=code, code_verifier=code_verifier)
    creds = flow.credentials
    existing = db.query(GmailOAuthToken).filter(GmailOAuthToken.user_id == user_id).first()
    if existing:
        existing.access_token = creds.token
        existing.refresh_token = existing.refresh_token or creds.refresh_token
        existing.token_expiry = creds.expiry
        existing.updated_at = datetime.now(timezone.utc)
    else:
        token = GmailOAuthToken(
            user_id=user_id,
            email="",  # Could fetch from Gmail API
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_expiry=creds.expiry,
        )
        db.add(token)
    db.commit()
    frontend = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    return RedirectResponse(url=f"{frontend}/jobs?gmail_connected=1")


@router.get("/status")
def gmail_status(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Check if Gmail is connected."""
    token = db.query(GmailOAuthToken).filter(GmailOAuthToken.user_id == current_user.id).first()
    return {"connected": token is not None, "email": token.email if token else None}


@router.post("/sync")
def sync_gmail_jobs(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Fetch job emails from Gmail, parse, sync to job applications."""
    from services.gmail_service import sync_emails_to_jobs
    result = sync_emails_to_jobs(current_user.id, db)
    if "error" in result:
        raise ValidationError(result["error"])
    return result


@router.delete("/disconnect")
def disconnect_gmail(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Remove Gmail connection."""
    db.query(GmailOAuthToken).filter(GmailOAuthToken.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Gmail disconnected"}
