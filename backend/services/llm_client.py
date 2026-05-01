"""High-level LLM helpers. All traffic goes through :func:`services.ai.factory.get_llm_provider`."""
from __future__ import annotations

import json
import logging
from typing import Any

from core.config import settings
from services.ai.factory import get_llm_provider
from services.ai.types import LLMRequest

logger = logging.getLogger(__name__)


class LLMService:
    """Resume parsing, study plans, questions, challenges — backed by Bedrock / OpenAI / compatible HTTP."""

    def __init__(self) -> None:
        self._max_tokens: int = int(settings.cursor_api_model_max_tokens or 4096)
        #: Set when the last ``_call`` returned None (for clearer API error messages).
        self.last_failure_reason: str | None = None

    def is_configured(self) -> bool:
        return get_llm_provider() is not None

    @property
    def client(self):
        """Deprecated: was raw OpenAI SDK client. Use ``is_configured()`` and ``_call``."""
        return None

    @property
    def model(self) -> str:
        """Best-effort model label for logs (Bedrock or OpenAI)."""
        if (settings.bedrock_model_id or "").strip():
            return (settings.bedrock_model_id or "").strip()
        if settings.openai_api_key:
            return settings.openai_api_model
        return settings.cursor_api_model

    def _call(
        self,
        system_prompt: str,
        user_content: str,
        response_format: str = "json_object",
        temperature: float | None = None,
        model: str | None = None,
    ) -> dict | None:
        """Make an LLM call. Returns parsed dict for ``json_object``, or ``{\"text\": ...}`` for plain text."""
        self.last_failure_reason = None
        prov = get_llm_provider()
        if not prov:
            self.last_failure_reason = (
                "No LLM provider: set BEDROCK_MODEL_ID + AWS_REGION (and AWS credentials), "
                "or OPENAI_API_KEY, or OPENAI_COMPATIBLE_BASE_URL + key for a compatible API."
            )
            logger.warning(self.last_failure_reason)
            return None

        fmt: Any = "json_object" if response_format == "json_object" else "text"
        temp = 0.7 if temperature is None else temperature
        meta: dict[str, Any] = {}
        if model:
            meta["model"] = model

        req = LLMRequest(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=temp,
            max_tokens=self._max_tokens,
            response_format=fmt,
            metadata=meta,
        )
        resp = prov.complete(req)
        if resp.error:
            self.last_failure_reason = resp.error
            return None
        if fmt == "json_object":
            return resp.parsed_json
        return {"text": resp.raw_text}

    def extract_skills(self, resume_text: str) -> list[dict[str, Any]]:
        """Extract skills from resume text."""
        system = """You are a resume parser. Extract technical and soft skills from the given resume text.
Return a JSON object with key "skills" containing a list of objects. Each object has:
- "skill_name": string (normalized skill name, e.g. "Python", "React")
- "category": "programming" | "framework" | "tool" | "soft_skill" | "other"
- "confidence": number 0-1
- "source_section": "skills" | "experience" | "education"
Extract all relevant skills. Be comprehensive."""

        result = self._call(system, resume_text[:8000])
        if not result or "skills" not in result:
            return []
        return result.get("skills", [])

    def infer_experience_level(self, experience_text: str) -> dict[str, Any]:
        """Infer experience level from experience section."""
        system = """You are a resume analyzer. Infer the candidate's experience level from the experience section.
Return a JSON object with:
- "experience_level": "junior" | "mid" | "senior"
- "years_experience": number (best estimate)
Be conservative. 0-2 years = junior, 2-5 = mid, 5+ = senior."""

        result = self._call(system, experience_text[:4000])
        if not result:
            return {"experience_level": "mid", "years_experience": 2}
        return result

    def extract_full_profile(self, resume_text: str) -> dict[str, Any]:
        """Extract full profile from resume: name, email, phone, education, summary, target role/industry."""
        system = """You are a resume parser. Extract structured profile data from the resume text.
Return a JSON object with:
- "full_name": string (candidate name, or null)
- "email": string (email address, or null)
- "phone": string (phone number, or null)
- "education_summary": string (brief education summary: degrees, institutions, or null)
- "professional_summary": string (summary/objective/profile section, or null)
- "target_role": string (desired role if mentioned, or null)
- "target_industry": string (industry focus if mentioned, or null)
Extract only what is clearly present. Use null for missing fields."""

        result = self._call(system, resume_text[:6000])
        if not result:
            return {}
        return result

    def generate_questions(
        self,
        skill: str,
        count: int = 5,
        difficulty: str = "medium",
        category: str = "conceptual",
    ) -> list[dict[str, Any]]:
        """Generate technical interview questions for a skill."""
        system = f"""You are an expert technical interviewer. Generate {count} {difficulty} {category} interview questions about {skill}.
Return a JSON object with key "questions" - a list of objects, each with:
- "question_text": string
- "answer_text": string (model answer)
- "skill_name": "{skill}"
- "difficulty": "{difficulty}"
- "category": "{category}"
Make questions practical and interview-relevant."""

        result = self._call(system, f"Generate {count} questions for skill: {skill}", temperature=0.5)
        if not result or "questions" not in result:
            return []
        return result.get("questions", [])

    def generate_challenge(
        self,
        skill: str,
        difficulty: str = "medium",
        language: str = "python",
    ) -> dict[str, Any] | None:
        """Generate a coding challenge with test cases."""
        from core.challenge_topics import TOPIC_SLUGS

        topics_hint = ", ".join(TOPIC_SLUGS)
        system = f"""You are a coding challenge creator. Create a {difficulty} coding challenge.

MANDATORY LANGUAGE (non-negotiable):
- The solution language is exactly: {language}
- JSON field "language" MUST be the string: "{language}" (same spelling).
- Title and description MUST be written for {language} only (no "implement in Python" if language is java, etc.).
- starter_code and solution_code MUST be valid {language} source code for this problem.

Skill context (topic area, may be a language name or a domain like Algorithms): {skill}

Allowed "language" values only: python, javascript, java, cpp, c.

Include a "topics" field: an array of 1–4 topic slugs chosen from this list only: {topics_hint}
Examples: Two-sum style → ["arrays","hash-table"]; linked list cycle → ["linked-list","two-pointers"]; Java streams API → ["streams","strings"].

Return a JSON object with:
- "title": string
- "description": string (problem statement, input/output format)
- "difficulty": "{difficulty}"
- "language": string (must be "{language}")
- "topics": array of strings (slugs from the list above)
- "starter_code": string (valid {language} entrypoint / stubs)
- "test_cases": list of objects with "input" (string), "expected_output" (string), "is_hidden" (bool)
- "solution_code": string (complete working solution in {language})
Create 3-5 test cases. At least one should be is_hidden: true."""

        result = self._call(
            system,
            f"Create one {difficulty} challenge: language={language}, skill/theme={skill}",
            temperature=0.4,
        )
        return result

    def anne_coding_hint(
        self,
        *,
        title: str,
        description: str,
        language: str,
        difficulty: str | None,
        visible_examples: list[dict[str, Any]],
        code_excerpt: str | None,
        stderr_excerpt: str | None,
        test_failure_summary: str | None,
        student_message: str | None,
        hint_style: str,
    ) -> dict[str, Any] | None:
        """Return ``{\"reply\": \"...\"}`` for tutor Anne, or None if the LLM is unavailable or failed."""
        system = """You are Anne, an expert and encouraging coding tutor on a learning platform.

Strict rules:
- Never give a complete solution or full copy-paste code that solves the assignment end-to-end.
- You may give algorithm steps, pseudocode, debugging checklists, or one-line conceptual snippets that are not a drop-in solution.
- Prefer Socratic teaching: ask what they tried, suggest edge cases, invariants, time/space tradeoffs, and how to narrow the bug.
- If they share compiler/runtime errors, explain what the error usually means and how to locate the line — do not rewrite their whole program.
- Match the problem's programming language when discussing syntax and idioms.
- Keep the reply concise (under ~400 words). Short paragraphs or bullet points are fine.

Return a JSON object with a single key \"reply\" (string, plain text or light markdown is OK)."""

        parts: list[str] = [
            f"hint_style: {hint_style}",
            "(hint_style meanings: light = gentle nudge; stuck = structured guidance without full answer; debug = focus on errors/failing tests.)",
            f"Challenge title: {title}",
            f"Programming language: {language}",
            f"Difficulty: {difficulty or 'unknown'}",
            "Problem statement:\n" + (description or "")[:12000],
        ]
        if visible_examples:
            parts.append(
                "Public example tests only (do not assume hidden tests):\n"
                + json.dumps(visible_examples, ensure_ascii=False)[:6000]
            )
        if code_excerpt and code_excerpt.strip():
            parts.append("Learner code excerpt (may be truncated):\n```\n" + code_excerpt.strip()[:8000] + "\n```")
        if stderr_excerpt and stderr_excerpt.strip():
            parts.append("stderr / error snippet:\n" + stderr_excerpt.strip()[:4000])
        if test_failure_summary and test_failure_summary.strip():
            parts.append("Test / run feedback summary:\n" + test_failure_summary.strip()[:2500])
        if student_message and student_message.strip():
            parts.append("Learner message:\n" + student_message.strip()[:2000])

        user_content = "\n\n".join(parts)
        result = self._call(system, user_content, response_format="json_object", temperature=0.55)
        if not result or not isinstance(result.get("reply"), str):
            return None
        reply = (result.get("reply") or "").strip()
        if not reply:
            return None
        return {"reply": reply}


llm_service = LLMService()
