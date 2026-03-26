"""
Parse job application emails from LinkedIn, Naukri, government portals, etc.
Extracts: company, role, status, sector (private/government), platform, external_id, notification_type.
"""
import re
from datetime import datetime
from typing import Any

# Platform detection by sender
LINKEDIN_SENDERS = (
    "linkedin.com",
    "notifications@linkedin.com",
    "messages-noreply@linkedin.com",
    "job-alerts@linkedin.com",
)
NAUKRI_SENDERS = (
    "naukri.com",
    "noreply@naukri.com",
    "job-alerts@naukri.com",
)
# Government job portals (India) - RRB, SEBI, IBPS, SSC, UPSC, PSC, etc.
GOVERNMENT_SENDERS = (
    "ssc.nic.in",
    "ssc.gov.in",
    "upsc.gov.in",
    "upsc.nic.in",
    "psc.",
    "recruitment.gov.in",
    "indgovtjobs",
    "rrb.",
    "rrbcdg.gov.in",
    "rrbchennai.gov.in",
    "rrbmumbai.gov.in",
    "rrbkolkata.gov.in",
    "rrbajmer.gov.in",
    "rrbbhopal.gov.in",
    "rrbsecunderabad.gov.in",
    "sebi.gov.in",
    "sebi.nic.in",
    "ibps.",
    "ibps.in",
    "ibps.org",
    "rbi.org.in",
    "rbi.gov.in",
    "licindia.in",
    "nic.in",
    "gov.in",
)

# Non-job notifications to EXCLUDE (do not treat as job applications)
# "viewed your application" is job-related (recruiter viewed your job app) - keep it
LINKEDIN_NON_JOB_PATTERNS = (
    "viewed your profile",
    "connection request",
    "wants to connect",
    "invitation to connect",
    "sent you a message",
    "messaged you",
    "congratulate",
    "work anniversary",
    "birthday",
    "linkedin learning",
    "skill assessment",
    "endorsed you",
    "recommended you",
    "shared a post",
    "commented on",
    "reacted to your",
    "followed you",
    "newsletter",
)

# Status keywords -> normalized status
STATUS_MAP = {
    "applied": ["applied", "application submitted", "you applied", "application sent"],
    "screening": ["screening", "under review", "being reviewed", "viewed your profile", "viewed your application"],
    "interview": ["interview", "scheduled", "schedule", "invited", "meeting", "call scheduled"],
    "offered": ["offer", "congratulations", "selected", "hired"],
    "rejected": ["rejected", "not moving forward", "other candidates", "unfortunately"],
}

# Notification type detection
NOTIFICATION_NEW_OPENING = ["new job", "new opening", "job alert", "new vacancy", "notification", "recruitment", "apply now"]
NOTIFICATION_VIEWED = ["viewed", "profile view", "application viewed"]
NOTIFICATION_STATUS = ["status", "update", "application", "interview", "offer", "rejected"]


def _normalize_status(text: str) -> str:
    """Infer status from email text."""
    text_lower = text.lower()
    for status, keywords in STATUS_MAP.items():
        if any(kw in text_lower for kw in keywords):
            return status
    return "applied"


def _extract_date(text: str) -> datetime | None:
    """Extract date from email (subject/body)."""
    # Common patterns: "Jan 15, 2024", "15-Jan-2024", "2024-01-15"
    patterns = [
        r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})",
        r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})",
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})",
    ]
    months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
              "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
    for m in re.finditer(r"|".join(patterns), text, re.IGNORECASE):
        try:
            g = m.groups()
            if len(g) == 3:
                a, b, c = g
                if a.lower()[:3] in months:
                    return datetime(int(c), months[a.lower()[:3]], int(b))
                if len(str(a)) == 4 and int(a) > 2000:  # year first
                    return datetime(int(a), int(b), int(c))
                return datetime(int(c), int(a), int(b))
        except (ValueError, TypeError):
            continue
    return None


def _extract_company_role(subject: str, body: str) -> tuple[str, str]:
    """Extract company and role from subject/body."""
    text = f"{subject} {body}"
    company, role = "", ""

    # Government: "RRB Group D Recruitment 2024" or "IBPS Clerk Notification" or "SEBI Grade A"
    m = re.search(r"(RRB|IBPS|SEBI|SSC|UPSC|RBI|LIC)\s+(?:[-\s]*)?(\w+(?:\s+\w+)*)\s+(?:recruitment|notification|exam|vacancy)", text, re.IGNORECASE)
    if m:
        company = m.group(1).upper()
        role = (m.group(2) or "").strip()[:200]
        return (company, role or "Recruitment")

    # "Software Engineer at Google" or "Google - Software Engineer"
    m = re.search(r"([^-–—]+)\s*(?:at|-|–|—)\s*([^-–—]+)", text, re.IGNORECASE)
    if m:
        role = m.group(1).strip()[:200]
        company = m.group(2).strip()[:200]

    # "Your application to X" or "Application for Y at Z"
    if not company:
        m = re.search(r"(?:application|applied)\s+(?:to|for)\s+([^,.\n]+?)(?:\s+at\s+([^,.\n]+))?", text, re.IGNORECASE)
        if m:
            role = (m.group(1) or "").strip()[:200]
            company = (m.group(2) or "").strip()[:200]

    # Fallback: first quoted or capitalized phrase
    if not role:
        m = re.search(r'"([^"]{3,200})"', text)
        if m:
            role = m.group(1).strip()[:200]

    # Naukri: "Job Alert: Company - Role"
    m = re.search(r"job\s*alert[:\s]+([^-]+)-([^\n]+)", text, re.IGNORECASE)
    if m:
        company = (company or m.group(1)).strip()[:200]
        role = (role or m.group(2)).strip()[:200]

    return (company or "Unknown Company")[:255], (role or "Unknown Role")[:255]


def _extract_external_id(body: str, subject: str) -> str | None:
    """Extract platform job ID for role mapping."""
    # LinkedIn: job IDs in URLs
    m = re.search(r"linkedin\.com/jobs/view/(\d+)", body + subject, re.IGNORECASE)
    if m:
        return f"linkedin_{m.group(1)}"
    # Naukri: job IDs
    m = re.search(r"jobid[=:](\d+)|naukri\.com[^/]*/(\d+)", body + subject, re.IGNORECASE)
    if m:
        return f"naukri_{m.group(1) or m.group(2)}"
    return None


def _detect_notification_type(subject: str, body: str) -> str:
    """Detect notification type: new_opening, viewed, status_update."""
    text = (subject + " " + body[:1500]).lower()
    if any(kw in text for kw in NOTIFICATION_NEW_OPENING) and "viewed" not in text:
        return "new_opening"
    if any(kw in text for kw in NOTIFICATION_VIEWED):
        return "viewed"
    return "status_update"


def _detect_government_portal(from_addr: str) -> str | None:
    """Detect government portal name from sender."""
    from_lower = from_addr.lower()
    if "ssc" in from_lower:
        return "SSC"
    if "upsc" in from_lower:
        return "UPSC"
    if "rrb" in from_lower:
        return "RRB"
    if "sebi" in from_lower:
        return "SEBI"
    if "ibps" in from_lower:
        return "IBPS"
    if "rbi" in from_lower:
        return "RBI"
    if "lic" in from_lower:
        return "LIC"
    if "psc" in from_lower:
        return "State PSC"
    if "recruitment" in from_lower or "gov" in from_lower or "nic.in" in from_lower:
        return "Government Portal"
    return None


def parse_job_email(
    from_addr: str,
    subject: str,
    body: str,
    date: datetime,
    email_id: str,
) -> dict[str, Any] | None:
    """
    Parse a job notification email. Returns extracted job info or None.
    Supports: LinkedIn, Naukri (private), SSC/UPSC/PSC (government).
    """
    from_lower = from_addr.lower()
    platform = None
    sector = "private"
    gov_portal = None

    if any(s in from_lower for s in LINKEDIN_SENDERS):
        platform = "linkedin"
        # Exclude non-job notifications (profile views, connection requests, messages, etc.)
        text_check = (subject + " " + body[:2000]).lower()
        if any(p in text_check for p in LINKEDIN_NON_JOB_PATTERNS):
            return None
        # Must look like a job: applied, application, job, interview, offer, etc.
        job_keywords = ("applied", "application", "job", "interview", "offer", "rejected", "hired", "position", "role")
        if not any(kw in text_check for kw in job_keywords):
            return None
    elif any(s in from_lower for s in NAUKRI_SENDERS):
        platform = "naukri"
    elif any(s in from_lower for s in GOVERNMENT_SENDERS):
        platform = "government"
        sector = "government"
        gov_portal = _detect_government_portal(from_addr) or "Government"
    else:
        return None

    company, role = _extract_company_role(subject, body)
    status = _normalize_status(subject + " " + body[:2000])
    external_id = _extract_external_id(body, subject)
    extracted_date = _extract_date(subject + " " + body[:1000]) or date
    notification_type = _detect_notification_type(subject, body)

    return {
        "platform": platform,
        "source": platform,
        "sector": sector,
        "company": company,
        "role": role,
        "status": status,
        "external_id": external_id,
        "applied_date": extracted_date,
        "notification_date": date,
        "notification_type": notification_type,
        "government_portal": gov_portal,
        "email_id": email_id,
        "email_date": date,
        "message": subject[:500],
    }
