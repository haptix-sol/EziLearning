"""Technical questions router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from core.exceptions import NotFoundError
from models import TechnicalQuestion, UserQuestionAnswer, Challenge, Execution
from schemas.content import QuestionResponse, SubmitAnswerRequest

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=list[QuestionResponse])
def list_questions(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    skill: str | None = Query(None),
    difficulty: str | None = Query(None),
) -> list[QuestionResponse]:
    """List technical questions."""
    q = db.query(TechnicalQuestion)
    if skill:
        q = q.filter(TechnicalQuestion.skill_name.ilike(f"%{skill}%"))
    if difficulty:
        q = q.filter(TechnicalQuestion.difficulty == difficulty)
    questions = q.order_by(TechnicalQuestion.created_at.desc()).limit(100).all()
    return [QuestionResponse.model_validate(x) for x in questions]


@router.post("/{question_id}/answer")
def submit_answer(
    question_id: str,
    current_user: CurrentUser,
    data: SubmitAnswerRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Submit answer to a question."""
    question = db.query(TechnicalQuestion).filter(TechnicalQuestion.id == question_id).first()
    if not question:
        raise NotFoundError("Question not found")
    existing = db.query(UserQuestionAnswer).filter(
        UserQuestionAnswer.user_id == current_user.id,
        UserQuestionAnswer.question_id == question_id,
    ).first()
    if existing:
        existing.user_answer = data.user_answer
        db.commit()
        return {"message": "Answer updated"}
    uqa = UserQuestionAnswer(
        user_id=current_user.id,
        question_id=question_id,
        user_answer=data.user_answer,
    )
    db.add(uqa)
    db.commit()
    return {"message": "Answer saved"}


@router.get("/trending")
def get_trending_challenges(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Trending coding questions (challenges)."""
    challenges = db.query(Challenge).order_by(Challenge.created_at.desc()).limit(20).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description[:200] + "..." if c.description and len(c.description) > 200 else c.description,
            "difficulty": c.difficulty,
            "language": c.language,
            "required_skills": c.required_skills or [],
        }
        for c in challenges
    ]


@router.get("/solved")
def get_solved_challenges(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """User's solved coding questions (executions with all tests passed)."""
    executions = (
        db.query(Execution)
        .filter(
            Execution.user_id == current_user.id,
            Execution.challenge_id.isnot(None),
            Execution.test_results.isnot(None),
        )
        .order_by(Execution.created_at.desc())
        .limit(50)
        .all()
    )
    solved = []
    seen_challenge_ids = set()
    for e in executions:
        if not e.test_results or e.challenge_id in seen_challenge_ids:
            continue
        if all(t.get("passed") for t in e.test_results):
            seen_challenge_ids.add(e.challenge_id)
            challenge = db.query(Challenge).filter(Challenge.id == e.challenge_id).first()
            if challenge:
                solved.append({
                    "id": challenge.id,
                    "title": challenge.title,
                    "difficulty": challenge.difficulty,
                    "solved_at": e.created_at.isoformat() if e.created_at else None,
                })
    return solved


@router.get("/quiz")
def get_quick_quiz(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    count: int = Query(5, ge=1, le=15),
):
    """Quick quiz: random subset of technical questions."""
    import random
    questions = db.query(TechnicalQuestion).order_by(TechnicalQuestion.id).limit(100).all()
    selected = random.sample(questions, min(count, len(questions))) if questions else []
    return [QuestionResponse.model_validate(q) for q in selected]
