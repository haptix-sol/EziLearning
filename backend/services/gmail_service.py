"""
Gmail API: fetch job-related emails, parse, sync to job applications.
"""
import base64
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from core.config import settings
from models import JobApplication, GmailOAuthToken
from services.job_email_parser import parse_job_email

logger = logging.getLogger(__name__)

# Search for job notifications: LinkedIn, Naukri, government (RRB, SEBI, IBPS, SSC, UPSC, RBI, LIC, etc.)
JOB_EMAIL_QUERY = (
    "from:linkedin.com OR from:naukri.com "
    "OR from:ssc.nic.in OR from:ssc.gov.in OR from:upsc.gov.in OR from:upsc.nic.in "
    "OR from:recruitment.gov.in OR from:indgovtjobs "
    "OR from:rrb OR from:rrbcdg.gov.in OR from:rrbchennai.gov.in OR from:rrbmumbai.gov.in "
    "OR from:rrbkolkata.gov.in OR from:rrbajmer.gov.in OR from:rrbbhopal.gov.in OR from:rrbsecunderabad.gov.in "
    "OR from:sebi.gov.in OR from:sebi.nic.in "
    "OR from:ibps OR from:ibps.in OR from:ibps.org "
    "OR from:rbi.org.in OR from:rbi.gov.in OR from:licindia.in "
    "OR from:nic.in OR from:gov.in "
    "newer_than:6m"
)
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def get_credentials_from_token(token: GmailOAuthToken) -> Credentials:
    """Build Credentials from stored token."""
    return Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )


def fetch_job_emails(creds: Credentials, max_results: int = 100) -> list[dict]:
    """Fetch job-related emails from Gmail."""
    service = build("gmail", "v1", credentials=creds)
    results = service.users().messages().list(
        userId="me",
        q=JOB_EMAIL_QUERY,
        maxResults=max_results,
    ).execute()
    messages = results.get("messages", [])
    emails = []
    for msg_ref in messages:
        try:
            msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
            payload = msg.get("payload", {})
            headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
            from_addr = headers.get("from", "")
            subject = headers.get("subject", "")
            date_str = headers.get("date", "")
            try:
                dt = parsedate_to_datetime(date_str) if date_str else datetime.now(timezone.utc)
            except Exception:
                dt = datetime.now(timezone.utc)
            body = ""
            if "body" in payload and payload["body"].get("data"):
                body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
            elif "parts" in payload:
                for part in payload["parts"]:
                    if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                        body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                        break
            emails.append({
                "id": msg["id"],
                "from": from_addr,
                "subject": subject,
                "body": body[:10000],
                "date": dt,
            })
        except Exception as e:
            logger.warning("Failed to fetch email %s: %s", msg_ref.get("id"), e)
    return emails


def sync_emails_to_jobs(user_id: str, db: Session) -> dict:
    """
    Fetch emails, parse, and upsert job applications.
    Returns {created, updated, total, errors}.
    """
    token = db.query(GmailOAuthToken).filter(GmailOAuthToken.user_id == user_id).first()
    if not token:
        return {"error": "Gmail not connected", "created": 0, "updated": 0, "total": 0}

    creds = get_credentials_from_token(token)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token.access_token = creds.token
        token.token_expiry = creds.expiry
        db.commit()

    emails = fetch_job_emails(creds)
    created, updated = 0, 0
    seen_external_ids: set[tuple[str, str, str]] = set()

    for e in emails:
        parsed = parse_job_email(
            from_addr=e["from"],
            subject=e["subject"],
            body=e["body"],
            date=e["date"],
            email_id=e["id"],
        )
        if not parsed:
            continue

        key = (parsed["company"], parsed["role"], parsed.get("external_id") or "")
        if key in seen_external_ids:
            continue
        seen_external_ids.add(key)

        # Find existing job by external_id or company+role+source
        existing = None
        if parsed.get("external_id"):
            existing = db.query(JobApplication).filter(
                JobApplication.user_id == user_id,
                JobApplication.external_id == parsed["external_id"],
            ).first()
        if not existing:
            existing = db.query(JobApplication).filter(
                JobApplication.user_id == user_id,
                JobApplication.company == parsed["company"],
                JobApplication.role == parsed["role"],
                JobApplication.source == parsed["source"],
            ).first()

        update_entry = {
            "date": parsed["email_date"].isoformat() if hasattr(parsed["email_date"], "isoformat") else str(parsed["email_date"]),
            "status": parsed["status"],
            "message": parsed["message"],
            "email_id": parsed["email_id"],
        }

        if existing:
            existing.status = parsed["status"]
            existing.updated_at = datetime.now(timezone.utc)
            existing.last_synced_at = datetime.now(timezone.utc)
            updates = existing.status_updates or []
            updates.append(update_entry)
            existing.status_updates = updates[-20:]
            if parsed.get("external_id"):
                existing.external_id = parsed["external_id"]
            if parsed.get("sector"):
                existing.sector = parsed["sector"]
            if parsed.get("notification_date"):
                existing.notification_date = parsed["notification_date"]
            if parsed.get("notification_type"):
                existing.notification_type = parsed["notification_type"]
            if parsed.get("government_portal"):
                existing.government_portal = parsed["government_portal"]
            updated += 1
        else:
            job = JobApplication(
                user_id=user_id,
                company=parsed["company"],
                role=parsed["role"],
                sector=parsed.get("sector", "private"),
                source=parsed["source"],
                status=parsed["status"],
                applied_date=parsed["applied_date"],
                notification_date=parsed.get("notification_date"),
                notification_type=parsed.get("notification_type"),
                external_id=parsed.get("external_id"),
                status_updates=[update_entry],
                government_portal=parsed.get("government_portal"),
                last_synced_at=datetime.now(timezone.utc),
            )
            db.add(job)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "total": len(emails)}
