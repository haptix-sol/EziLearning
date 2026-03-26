"""Resume parsing: text extraction, structure parsing, skill extraction. No external API - pure Python."""
import io
import logging
import re
from pathlib import Path
from uuid import uuid4

import pdfplumber
from docx import Document
from sqlalchemy.orm import Session

from core.config import settings
from models import Resume, UserProfile, ResumeSkill

logger = logging.getLogger(__name__)

# Known technical skills for extraction (regex-friendly)
KNOWN_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Kotlin", "Swift",
    "React", "Angular", "Vue", "Node.js", "Django", "Flask", "FastAPI", "Spring", "Express",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
    "Git", "Linux", "REST", "GraphQL", "Machine Learning", "TensorFlow", "PyTorch", "Pandas",
    "HTML", "CSS", "SASS", "Redux", "jQuery", "Agile", "Scrum", "JIRA", "CI/CD", "Jenkins",
]

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def extract_text_from_file(content: bytes, file_type: str) -> str:
    """Extract raw text from PDF or DOCX."""
    if "pdf" in file_type:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    if "wordprocessingml" in file_type or "docx" in file_type:
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError("Unsupported file type")


def parse_resume_sections(raw_text: str) -> dict[str, str]:
    """Parse resume into sections using regex heuristics."""
    sections = {
        "skills": "",
        "experience": "",
        "education": "",
        "summary": "",
    }
    text = raw_text.strip()
    # Common section headers (case insensitive)
    # Match section headers at line start; use \b so "Experienced" doesn't match "experience"
    patterns = {
        "skills": r"(?:^|\n)\s*(?:skills|technical skills|technologies|expertise)\b\s*[:\-]?\s*(.*?)(?=(?:^|\n)\s*(?:experience|education|work|employment|summary)\b|$)",
        "experience": r"(?:^|\n)\s*(?:work\s+)?(?:experience|employment|professional experience)\b\s*[:\-]?\s*(.*?)(?=(?:^|\n)\s*(?:education|skills|summary)\b|$)",
        "education": r"(?:^|\n)\s*(?:education|academic)\b\s*[:\-]?\s*(.*?)(?=(?:^|\n)\s*(?:experience|skills|summary)\b|$)",
        "summary": r"(?:^|\n)\s*(?:summary|objective|profile|about)\b\s*[:\-]?\s*(.*?)(?=(?:^|\n)\s*(?:experience|education|skills)\b|$)",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            sections[key] = match.group(1).strip()[:2000]
    # If no sections matched, use full text for skills/experience
    if not any(sections.values()):
        sections["skills"] = text[:3000]
        sections["experience"] = text[:3000]
    return sections


def _extract_skills(text: str) -> list[dict]:
    """Extract skills from text using known skill list and regex. No external API."""
    text_lower = text.lower()
    found: dict[str, dict] = {}
    for skill in KNOWN_SKILLS:
        pattern = re.escape(skill)
        if re.search(rf"\b{pattern}\b", text, re.IGNORECASE):
            found[skill.lower()] = {
                "skill_name": skill,
                "category": "programming" if skill in ("Python", "Java", "JavaScript", "Go", "C++", "C#", "Rust", "Kotlin", "Swift") else "framework" if skill in ("React", "Angular", "Vue", "Django", "Flask", "Spring") else "tool" if skill in ("Git", "Docker", "AWS", "Azure", "JIRA") else "other",
                "confidence": 0.9,
                "source_section": "skills" if "skill" in text_lower[:500] else "experience",
            }
    # Also extract comma-separated or bullet skills (e.g. "Python, Java, SQL")
    for match in re.finditer(r"\b([A-Z][a-zA-Z0-9+#\.\-_]+(?:\s*/\s*[A-Z][a-zA-Z0-9+#\.\-_]+)?)\b", text):
        s = match.group(1).strip()
        if len(s) >= 2 and len(s) <= 40 and s.lower() not in found:
            if any(k in s for k in ["script", "SQL", "API", "ML", "AI", "Dev", "Cloud"]):
                found[s.lower()] = {"skill_name": s, "category": "other", "confidence": 0.7, "source_section": "skills"}
    return list(found.values())[:50]


def _infer_experience_level(experience_text: str) -> dict:
    """Infer experience level from text using regex for years. No external API."""
    text = experience_text.lower()
    years = None
    # Match "5 years", "3+ years", "2-4 years", "5+ years of experience"
    for m in re.finditer(r"(\d+)\s*[+\-]?\s*years?\s*(?:of\s*)?(?:experience|exp)?", text, re.IGNORECASE):
        y = int(m.group(1))
        if years is None or y > years:
            years = y
    # Match date ranges: "2018 - 2023" -> ~5 years
    for m in re.finditer(r"20\d{2}\s*[-–]\s*20\d{2}|20\d{2}\s*to\s*(?:present|now)", text):
        parts = re.findall(r"20\d{2}", m.group(0))
        if len(parts) >= 2:
            span = int(parts[-1]) - int(parts[0])
            if years is None or span > years:
                years = span
        else:
            if years is None:
                years = 2  # Assume 2 if "present"
    if years is None:
        years = 2
    level = "junior" if years < 2 else "senior" if years >= 5 else "mid"
    return {"experience_level": level, "years_experience": years}


def _extract_full_profile(raw_text: str, sections: dict[str, str]) -> dict:
    """Extract profile fields using regex. No external API."""
    text = raw_text.strip()
    result = {}
    # Email
    email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    result["email"] = email_match.group(0) if email_match else None
    # Phone (various formats)
    phone_match = re.search(r"[+]?\d[\d\s\-\.()]{9,18}\d", text)
    result["phone"] = phone_match.group(0).strip() if phone_match else None
    # Full name: often first non-empty line before email/phone
    lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 2]
    if lines:
        first = lines[0]
        if not re.search(r"@|^\d|linkedin|github|resume|curriculum", first, re.IGNORECASE):
            if len(first) <= 50 and re.match(r"^[A-Za-z\s\.\-]+$", first):
                result["full_name"] = first
            else:
                result["full_name"] = None
        else:
            result["full_name"] = None
    else:
        result["full_name"] = None
    # Education summary
    result["education_summary"] = sections.get("education", "").strip()[:500] or None
    # Professional summary
    result["professional_summary"] = sections.get("summary", "").strip()[:500] or None
    # Target role
    target_match = re.search(r"(?:seeking|looking for|target|interested in|role|position)\s*[:\-]?\s*([^\n\.]{5,80})", text, re.IGNORECASE)
    result["target_role"] = target_match.group(1).strip() if target_match else None
    # Target industry
    industry_match = re.search(r"(?:industry|sector)\s*[:\-]?\s*([^\n\.]{3,60})", text, re.IGNORECASE)
    result["target_industry"] = industry_match.group(1).strip() if industry_match else None
    return result


def process_resume(
    user_id: str,
    file_content: bytes,
    file_name: str,
    file_type: str,
    db: Session,
) -> tuple[Resume, UserProfile]:
    """Process uploaded resume: extract text, parse, extract skills, store."""
    if file_type not in ALLOWED_TYPES:
        raise ValueError("Unsupported format. Use PDF or DOCX.")
    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError("File too large. Max 5MB.")

    raw_text = extract_text_from_file(file_content, file_type)
    sections = parse_resume_sections(raw_text)

    # Extract skills (internal - no API)
    skill_input = f"{sections['skills']}\n\n{sections['experience']}"
    skills_data = _extract_skills(skill_input)

    # Infer experience level (internal - no API)
    exp_input = sections["experience"] or raw_text[:2000]
    level_data = _infer_experience_level(exp_input)
    experience_level = level_data.get("experience_level", "mid")
    years_experience = level_data.get("years_experience")

    # Extract full profile (internal - no API)
    profile_data = _extract_full_profile(raw_text, sections)

    # Store resume file
    storage_path = Path(settings.resume_storage_path)
    storage_path.mkdir(parents=True, exist_ok=True)
    resume_filename = f"{user_id}_{uuid4().hex[:8]}.bin"
    file_path = str(storage_path / resume_filename)
    Path(file_path).write_bytes(file_content)

    resume = Resume(
        user_id=user_id,
        file_path=file_path,
        file_name=file_name,
        file_type=file_type,
        raw_text=raw_text[:50000],  # Limit stored text
        parsed_json=sections,
    )
    db.add(resume)
    db.flush()

    # Create or update user profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id, resume_id=resume.id)
        db.add(profile)
        db.flush()
    else:
        # Clear old skills
        db.query(ResumeSkill).filter(ResumeSkill.user_profile_id == profile.id).delete()
        profile.resume_id = resume.id

    profile.experience_level = experience_level
    profile.years_experience = years_experience
    profile.full_name = profile_data.get("full_name") or None
    profile.email = profile_data.get("email") or None
    profile.phone = profile_data.get("phone") or None
    profile.education_summary = profile_data.get("education_summary") or None
    profile.professional_summary = profile_data.get("professional_summary") or None
    profile.target_role = profile_data.get("target_role") or None
    profile.target_industry = profile_data.get("target_industry") or None

    for s in skills_data[:50]:  # Limit to 50 skills
        skill = ResumeSkill(
            user_profile_id=profile.id,
            skill_name=s.get("skill_name", "Unknown")[:100],
            category=s.get("category"),
            confidence=float(s.get("confidence", 0.8)) if s.get("confidence") is not None else 0.8,
            source_section=s.get("source_section"),
        )
        db.add(skill)

    db.commit()
    db.refresh(resume)
    db.refresh(profile)
    return resume, profile
