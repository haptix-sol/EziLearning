"""Level content generation and completion logic. Resume-driven via Cursor LLM."""
from sqlalchemy.orm import Session

from models import (
    Challenge,
    TechnicalQuestion,
    UserProfile,
    UserQuestionAnswer,
    Execution,
    LevelCompletion,
    UserLevelContent,
)
from services.content_generator import generate_challenges_for_user, generate_questions_for_user
from services.llm_client import llm_service


TOTAL_LEVELS = 20  # Configurable max levels
CHALLENGES_PER_LEVEL = 1
QUESTIONS_PER_LEVEL = 2


def get_completed_levels(user_id: str, db: Session) -> set[int]:
    """Get set of completed level numbers for user."""
    completions = db.query(LevelCompletion.level_number).filter(
        LevelCompletion.user_id == user_id,
    ).all()
    return {c[0] for c in completions}


def get_current_level(user_id: str, db: Session) -> int:
    """Get user's current level (next to complete). 1-based."""
    completed = get_completed_levels(user_id, db)
    for n in range(1, TOTAL_LEVELS + 1):
        if n not in completed:
            return n
    return TOTAL_LEVELS + 1  # All done


def is_level_unlocked(level_number: int, completed: set[int]) -> bool:
    """Level N unlocked if level N-1 is completed (level 1 always unlocked)."""
    if level_number <= 1:
        return True
    return (level_number - 1) in completed


def _challenge_completed(user_id: str, challenge_id: str, db: Session) -> bool:
    """Check if user passed the challenge (submitted with all tests passed)."""
    execs = db.query(Execution).filter(
        Execution.user_id == user_id,
        Execution.challenge_id == challenge_id,
        Execution.status == "completed",
    ).all()
    for e in execs:
        if e.test_results and all(t.get("passed") for t in e.test_results):
            return True
    return False


def _question_answered(user_id: str, question_id: str, db: Session) -> bool:
    """Check if user answered the question."""
    return db.query(UserQuestionAnswer).filter(
        UserQuestionAnswer.user_id == user_id,
        UserQuestionAnswer.question_id == question_id,
    ).first() is not None


def get_level_content_status(
    user_id: str,
    level_number: int,
    db: Session,
) -> tuple[list[dict], list[dict], bool]:
    """
    Get challenges and questions for level, with completion status.
    Returns (challenges, questions, all_complete).
    """
    rows = db.query(UserLevelContent).filter(
        UserLevelContent.user_id == user_id,
        UserLevelContent.level_number == level_number,
    ).all()
    challenges = []
    questions = []
    for r in rows:
        if r.content_type == "challenge":
            c = db.query(Challenge).filter(Challenge.id == r.content_id).first()
            if c:
                completed = _challenge_completed(user_id, c.id, db)
                challenges.append({
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "difficulty": c.difficulty,
                    "completed": completed,
                })
        else:
            q = db.query(TechnicalQuestion).filter(TechnicalQuestion.id == r.content_id).first()
            if q:
                answered = _question_answered(user_id, q.id, db)
                questions.append({
                    "id": q.id,
                    "question_text": q.question_text,
                    "skill_name": q.skill_name,
                    "difficulty": q.difficulty,
                    "answered": answered,
                })
    all_complete = (
        len(challenges) > 0 and all(x["completed"] for x in challenges) and
        len(questions) > 0 and all(x["answered"] for x in questions)
    )
    return challenges, questions, all_complete


def ensure_level_content(user_id: str, level_number: int, db: Session) -> tuple[list[dict], list[dict], bool]:
    """
    Ensure level has content (generate if needed). Return challenges, questions, all_complete.
    """
    challenges, questions, all_complete = get_level_content_status(user_id, level_number, db)
    if challenges or questions:
        return challenges, questions, all_complete

    # Generate content via LLM (resume-driven; fallback if no profile)
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    skills = [s.skill_name for s in profile.skills] if profile and profile.skills else ["Python", "Algorithms"]
    difficulty = "easy" if (profile and profile.experience_level == "junior") else "medium"

    # Generate 1 challenge
    skill = skills[level_number % len(skills)] if skills else "Python"
    ch_data = llm_service.generate_challenge(skill, difficulty=difficulty, language="python")
    if ch_data:
        ch = Challenge(
            title=ch_data.get("title", f"Level {level_number} Challenge"),
            description=ch_data.get("description", ""),
            difficulty=ch_data.get("difficulty", difficulty),
            language=ch_data.get("language", "python"),
            starter_code=ch_data.get("starter_code"),
            solution_code=ch_data.get("solution_code"),
            test_cases=ch_data.get("test_cases", []),
            required_skills=[skill],
        )
        db.add(ch)
        db.flush()
        db.add(UserLevelContent(user_id=user_id, level_number=level_number, content_type="challenge", content_id=ch.id))
        challenges.append({
            "id": ch.id,
            "title": ch.title,
            "description": ch.description,
            "difficulty": ch.difficulty,
            "completed": False,
        })

    # Generate 2 questions
    for i in range(QUESTIONS_PER_LEVEL):
        skill_q = skills[(level_number + i) % len(skills)] if skills else "Python"
        qs_data = llm_service.generate_questions(skill_q, count=1, difficulty=difficulty)
        if qs_data:
            qd = qs_data[0]
            tq = TechnicalQuestion(
                question_text=qd.get("question_text", ""),
                answer_text=qd.get("answer_text"),
                skill_name=qd.get("skill_name", skill_q),
                difficulty=qd.get("difficulty", difficulty),
                category="conceptual",
            )
            db.add(tq)
            db.flush()
            db.add(UserLevelContent(user_id=user_id, level_number=level_number, content_type="question", content_id=tq.id))
            questions.append({
                "id": tq.id,
                "question_text": tq.question_text,
                "skill_name": tq.skill_name,
                "difficulty": tq.difficulty,
                "answered": False,
            })

    db.commit()
    return challenges, questions, False


def complete_level(user_id: str, level_number: int, db: Session) -> dict | None:
    """
    Mark level as complete if all tasks done. Returns completion info or None.
    """
    _, _, all_complete = get_level_content_status(user_id, level_number, db)
    if not all_complete:
        return None

    existing = db.query(LevelCompletion).filter(
        LevelCompletion.user_id == user_id,
        LevelCompletion.level_number == level_number,
    ).first()
    if existing:
        return {"level_number": level_number, "stars": existing.stars, "already_completed": True}

    lc = LevelCompletion(user_id=user_id, level_number=level_number, stars=3)
    db.add(lc)
    db.commit()
    return {"level_number": level_number, "stars": 3, "unlocked_next": True}
