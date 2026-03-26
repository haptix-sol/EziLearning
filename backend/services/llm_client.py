"""LLM client: OpenAI or Cursor API for skill extraction, questions, video scripts, etc."""
import json
import logging
import re
from typing import Any

from core.config import settings

logger = logging.getLogger(__name__)


def _parse_json_response(content: str) -> dict[str, Any]:
    """
    Parse model output as JSON. Handles markdown fences and leading/trailing prose.
    Cursor proxy / some models ignore json_object or return empty whitespace.
    """
    text = (content or "").strip()
    if not text:
        raise ValueError("empty model content")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        inner = m.group(1).strip()
        if inner:
            try:
                return json.loads(inner)
            except json.JSONDecodeError:
                pass
    # First top-level JSON object (balanced braces)
    start = text.find("{")
    if start != -1:
        try:
            obj, _end = json.JSONDecoder().raw_decode(text[start:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    raise ValueError(f"not valid JSON (len={len(text)}, preview={text[:200]!r})")


def _get_client():
    """Return OpenAI-compatible client. Prefer OpenAI, then cursor2api/Cursor proxy."""
    try:
        from openai import OpenAI
        # OpenAI API - works out of the box
        if settings.openai_api_key:
            return (
                OpenAI(api_key=settings.openai_api_key),
                settings.openai_api_model,
                0.7,
                4096,
            )
        # cursor2api or Cursor proxy - CURSOR_API_URL points to proxy (e.g. http://localhost:3010/v1)
        if settings.cursor_api_url:
            base_url = settings.cursor_api_url.rstrip("/")
            if not base_url.endswith("/v1"):
                base_url = base_url + "/v1"
            api_key = settings.cursor_api_key or "cursor2api"  # placeholder when proxy has no auth
            return (
                OpenAI(api_key=api_key, base_url=base_url),
                settings.cursor_api_model,
                settings.cursor_api_model_temperature,
                settings.cursor_api_model_max_tokens,
            )
        # Legacy: CURSOR_API_KEY without URL (api.cursor.com - no chat API, will likely fail)
        if settings.cursor_api_key:
            base_url = "https://api.cursor.com/v1"
            return (
                OpenAI(api_key=settings.cursor_api_key, base_url=base_url),
                settings.cursor_api_model,
                settings.cursor_api_model_temperature,
                settings.cursor_api_model_max_tokens,
            )
    except Exception as e:
        logger.warning("LLM client init failed: %s", e)
    return None


class LLMService:
    """LLM client using Cursor API (OpenAI-compatible)."""

    def __init__(self) -> None:
        self._client = None
        self._model = None
        self._temperature = 0.2
        self._max_tokens = 4096
        #: Set when the last `_call` returned None (for clearer API error messages).
        self.last_failure_reason: str | None = None

    def _ensure_client(self):
        if self._client is not None:
            return self._client is not None
        result = _get_client()
        if result is None:
            return False
        self._client, self._model, self._temperature, self._max_tokens = result
        return True

    @property
    def client(self):
        """Raw client for direct chat.completions calls."""
        if not self._ensure_client():
            return None
        return self._client

    @property
    def model(self) -> str:
        if not self._ensure_client():
            return settings.cursor_api_model
        return self._model

    @property
    def video_model(self) -> str:
        """Faster model for video generation when configured. Reduces LLM latency."""
        if settings.openai_api_key and settings.openai_api_model_video:
            return settings.openai_api_model_video
        if (settings.cursor_api_url or settings.cursor_api_key) and settings.cursor_api_model_video:
            return settings.cursor_api_model_video
        return self.model

    def _call(
        self,
        system_prompt: str,
        user_content: str,
        response_format: str = "json_object",
        temperature: float | None = None,
        model: str | None = None,
    ) -> dict | None:
        """Make an LLM call. Returns parsed JSON or None on failure. Use model= for override (e.g. video_model)."""
        self.last_failure_reason = None
        if not self._ensure_client():
            self.last_failure_reason = (
                "No LLM client: set OPENAI_API_KEY in .env, or CURSOR_API_URL (e.g. http://localhost:3010/v1) "
                "for the local Cursor proxy."
            )
            logger.warning("No LLM API key configured (OPENAI_API_KEY or CURSOR_API_KEY)")
            return None
        temp = temperature if temperature is not None else self._temperature
        use_model = model or self.model
        try:
            kwargs = {
                "model": use_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "temperature": temp,
                "max_tokens": self._max_tokens,
                "timeout": settings.llm_timeout,
            }
            if response_format:
                kwargs["response_format"] = {"type": response_format}

            response = self._client.chat.completions.create(**kwargs)
            raw = response.choices[0].message.content
            content = (raw or "").strip()
            if not content:
                self.last_failure_reason = (
                    f"Empty response from model {use_model!r} (check proxy logs, timeouts, or json_object support)."
                )
                logger.warning(
                    "LLM returned empty message content (model=%s). Check proxy/Cursor and json_object support.",
                    use_model,
                )
                return None
            if response_format == "json_object":
                try:
                    return _parse_json_response(content)
                except ValueError as e:
                    self.last_failure_reason = f"Model output was not valid JSON: {e}"
                    logger.warning("LLM JSON parse failed: %s", e)
                    return None
            return {"text": content}
        except Exception as e:
            self.last_failure_reason = f"LLM request failed: {e}"
            logger.exception("LLM call failed: %s", e)
            return None

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
        system = f"""You are a coding challenge creator. Create a {difficulty} {language} coding challenge testing {skill}.
Return a JSON object with:
- "title": string
- "description": string (problem statement, input/output format)
- "difficulty": "{difficulty}"
- "starter_code": string (function signature with pass/docstring)
- "test_cases": list of objects with "input" (string), "expected_output" (string), "is_hidden" (bool)
- "solution_code": string (complete working solution)
Create 3-5 test cases. At least one should be is_hidden: true."""

        result = self._call(system, f"Create a {difficulty} {language} challenge for {skill}", temperature=0.4)
        return result


llm_service = LLMService()
