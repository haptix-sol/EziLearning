"""Content generation: questions, challenges via Cursor LLM."""
from sqlalchemy.orm import Session

from models import TechnicalQuestion, Challenge, UserProfile
from services.llm_client import llm_service

# Fallback seed questions when LLM is unavailable
FALLBACK_QUESTIONS = [
    {
        "question_text": "Explain the difference between list and tuple in Python.",
        "answer_text": "Lists are mutable, tuples are immutable. Lists use [], tuples use ().",
        "skill_name": "Python",
        "difficulty": "easy",
        "category": "conceptual",
    },
    {
        "question_text": "What is the time complexity of binary search?",
        "answer_text": "O(log n) for sorted arrays.",
        "skill_name": "Algorithms",
        "difficulty": "easy",
        "category": "conceptual",
    },
    {
        "question_text": "Explain REST API principles.",
        "answer_text": "Stateless, resource-based, HTTP methods (GET, POST, PUT, DELETE).",
        "skill_name": "API",
        "difficulty": "medium",
        "category": "conceptual",
    },
]

# Fallback seed challenges
FALLBACK_CHALLENGES = [
    {
        "title": "Two Sum",
        "description": "Given an array of integers and a target, return indices of two numbers that add up to target.",
        "difficulty": "easy",
        "language": "python",
        "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    pass",
        "test_cases": [
            {"input": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]", "is_hidden": False},
            {"input": "[3, 2, 4], 6", "expected_output": "[1, 2]", "is_hidden": True},
        ],
        "required_skills": ["Python", "Algorithms"],
    },
]


def generate_questions_for_user(user_id: str, db: Session, count_per_skill: int = 5) -> list[TechnicalQuestion]:
    """Generate questions based on user profile skills."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    skills = [s.skill_name for s in profile.skills] if profile and profile.skills else ["Python", "Algorithms"]
    difficulty = "easy" if profile and profile.experience_level == "junior" else "medium"

    created = []
    for skill in skills[:5]:  # Limit to 5 skills
        questions_data = llm_service.generate_questions(skill, count=count_per_skill, difficulty=difficulty)
        if not questions_data:
            # Use fallback filtered by skill
            questions_data = [q for q in FALLBACK_QUESTIONS if skill.lower() in q["skill_name"].lower()]
            if not questions_data:
                questions_data = FALLBACK_QUESTIONS[:2]
        for q in questions_data:
            existing = db.query(TechnicalQuestion).filter(
                TechnicalQuestion.question_text == q.get("question_text", "")[:500]
            ).first()
            if not existing:
                tq = TechnicalQuestion(
                    question_text=q.get("question_text", ""),
                    answer_text=q.get("answer_text"),
                    skill_name=q.get("skill_name", skill),
                    difficulty=q.get("difficulty", difficulty),
                    category=q.get("category", "conceptual"),
                )
                db.add(tq)
                db.flush()
                created.append(tq)
    db.commit()
    for c in created:
        db.refresh(c)
    return created


def generate_challenges_for_user(user_id: str, db: Session, count: int = 3) -> list[Challenge]:
    """Generate coding challenges based on user profile."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    skills = [s.skill_name for s in profile.skills] if profile and profile.skills else ["Python"]
    difficulty = "easy" if profile and profile.experience_level == "junior" else "medium"

    created = []
    for skill in skills[:3]:
        data = llm_service.generate_challenge(skill, difficulty=difficulty, language="python")
        if data:
            ch = Challenge(
                title=data.get("title", "Coding Challenge"),
                description=data.get("description", ""),
                difficulty=data.get("difficulty", difficulty),
                language=data.get("language", "python"),
                starter_code=data.get("starter_code"),
                solution_code=data.get("solution_code"),
                test_cases=data.get("test_cases", []),
                required_skills=[skill],
            )
            db.add(ch)
            db.flush()
            created.append(ch)
    if not created:
        for fc in FALLBACK_CHALLENGES[:count]:
            ch = Challenge(
                title=fc["title"],
                description=fc["description"],
                difficulty=fc["difficulty"],
                language=fc["language"],
                starter_code=fc["starter_code"],
                test_cases=fc["test_cases"],
                required_skills=fc["required_skills"],
            )
            db.add(ch)
            db.flush()
            created.append(ch)
    db.commit()
    for c in created:
        db.refresh(c)
    return created
