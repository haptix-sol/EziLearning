"""Generate study plans and notes via Cursor LLM. No static templates - all content from API."""
from sqlalchemy.orm import Session

from models import StudyPlan, DayPlan, UserProfile
from services.llm_client import llm_service

# Cursor proxy JSON fallbacks when upstream is empty/refused (see cursor2api openai-handler).
_PROXY_ERROR_PAYLOADS = frozenset({"model_refused", "tool_capabilities_unavailable"})


def _study_plan_failure_message(detail: str | None) -> str:
    setup = (
        " For setup: set OPENAI_API_KEY, or run the Cursor proxy and set CURSOR_API_URL (e.g. http://localhost:3010/v1). "
        "api.cursor.com has no OpenAI-compatible chat API."
    )
    if detail:
        return f"Could not generate study plan. {detail.strip()}{setup}"
    return (
        "Could not generate study plan. The model did not return JSON with a top-level \"days\" array." + setup
    )


def _profile_context(profile: UserProfile | None) -> str:
    """Build context string from user profile for personalized plans."""
    if not profile:
        return ""
    parts = []
    if profile.experience_level:
        parts.append(f"Experience level: {profile.experience_level}")
    if profile.years_experience is not None:
        parts.append(f"Years of experience: {profile.years_experience}")
    if profile.target_role:
        parts.append(f"Target role: {profile.target_role}")
    if profile.target_industry:
        parts.append(f"Target industry: {profile.target_industry}")
    if profile.skills:
        skill_names = [s.skill_name for s in profile.skills[:15]]
        parts.append(f"Known skills: {', '.join(skill_names)}")
    if not parts:
        return ""
    return "Candidate context: " + "; ".join(parts)


def generate_plan_with_llm(
    duration_days: int,
    focus_area: str | None = None,
    profile: UserProfile | None = None,
) -> list[dict] | None:
    """Use LLM to generate a personalized study plan. Returns list of day dicts or None."""
    if not llm_service.client:
        llm_service.last_failure_reason = (
            "No LLM client: set OPENAI_API_KEY, or CURSOR_API_URL with the proxy running."
        )
        return None
    profile_ctx = _profile_context(profile)
    focus = f"Focus area: {focus_area}" if focus_area else "Cover: programming basics, data structures, algorithms, system design, behavioral."
    prompt = f"""Create a {duration_days}-day interview preparation study plan from scratch.
{focus}
{profile_ctx}
Personalize the plan based on the candidate's skills and experience. For stronger skills, go deeper or skip basics.
Return JSON with key "days": list of objects, each with:
- "day" (number), "title" (string), "topics" (array of strings),
- "subtopics" (object: topic name -> array of subtopic strings, e.g. {{"Arrays": ["Traversal", "Two pointers"], "Sorting": ["Quick sort", "Merge sort"]}}),
- "type" ("read"|"study"|"practice"|"test"), "mins" (number).
Recommended daily time: 60-120 mins. Include mix of read, study, practice, test. Exactly {duration_days} days."""
    result = llm_service._call(
        "You are an expert interview prep coach. Output a single JSON object only: no markdown, no code fences, "
        "no introduction or 'I am Claude' text. Start with { and end with }. Required top-level key: \"days\".",
        prompt,
        temperature=0.4,
    )
    if result and result.get("error") in _PROXY_ERROR_PAYLOADS:
        err = result.get("error")
        msg = (result.get("message") or "").strip()
        raise ValueError(
            "Study plan generation failed: the model or Cursor proxy returned an error instead of a plan "
            f"({err!r}). {msg} Retry, check proxy logs, increase LLM_TIMEOUT, or use OPENAI_API_KEY."
        )
    if result and "days" in result:
        return result["days"]
    if result:
        llm_service.last_failure_reason = (
            f"JSON had no 'days' key (got keys: {list(result.keys())}). Wrong schema or truncated output."
        )
    return None


def create_study_plan(user_id: str, duration_days: int, focus_area: str | None, db: Session) -> StudyPlan:
    from models import Challenge
    """Create study plan with day-by-day roadmap. All content from LLM API - no static fallback."""
    plan_type = {7: "1_week", 14: "2_weeks", 30: "1_month"}.get(duration_days, "custom")
    plan = StudyPlan(user_id=user_id, duration_days=duration_days, plan_type=plan_type, focus_area=focus_area)
    db.add(plan)
    db.flush()

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    days_data = generate_plan_with_llm(duration_days, focus_area, profile)

    if not days_data:
        raise ValueError(_study_plan_failure_message(llm_service.last_failure_reason))

    challenges = db.query(Challenge).limit(50).all()
    for i, d in enumerate(days_data[:duration_days]):
        act_type = d.get("type", "study")
        challenge_id = None
        if act_type in ("practice", "test") and challenges:
            challenge_id = challenges[i % len(challenges)].id
        day_plan = DayPlan(
            study_plan_id=plan.id,
            day_number=d.get("day", i + 1),
            title=d.get("title", f"Day {i + 1}"),
            topics=d.get("topics", []),
            subtopics=d.get("subtopics") or {},
            activity_type=act_type,
            duration_minutes=d.get("mins", 60),
            level=min((i // 5) + 1, 6),
            order_index=i,
            challenge_id=challenge_id,
        )
        db.add(day_plan)

    db.commit()
    db.refresh(plan)
    return plan


def generate_notes_for_topic(topic: str, day_title: str) -> str:
    """Generate study notes for a topic via LLM."""
    if not llm_service.client:
        return f"## {topic}\n\nStudy this topic. Focus on key concepts, examples, and common interview questions."
    try:
        response = llm_service.client.chat.completions.create(
            model=llm_service.model,
            messages=[
                {"role": "system", "content": "You are a technical interview prep coach. Create concise study notes in markdown."},
                {"role": "user", "content": f"Create study notes for: {topic}. Part of: {day_title}. Include: key concepts, 2-3 examples, 2-3 common interview questions."},
            ],
            temperature=0.3,
            timeout=30,
        )
        return response.choices[0].message.content or f"## {topic}\n\nStudy this topic."
    except Exception:
        return f"## {topic}\n\nStudy this topic. Focus on key concepts and examples."
