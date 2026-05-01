"""Technical questions router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from core.exceptions import NotFoundError
from models import TechnicalQuestion, UserQuestionAnswer, Challenge, Execution
from schemas.content import QuestionPublic, SubmitAnswerRequest, SubmitAnswerResponse
from services.question_answer_eval import evaluate_learner_answer
from services.level_service import execution_passed_challenge_tests

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=list[QuestionPublic])
def list_questions(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    skill: str | None = Query(None),
    difficulty: str | None = Query(None),
) -> list[QuestionPublic]:
    """List technical questions (reference answers are not returned)."""
    q = db.query(TechnicalQuestion)
    if skill:
        q = q.filter(TechnicalQuestion.skill_name.ilike(f"%{skill}%"))
    if difficulty:
        q = q.filter(TechnicalQuestion.difficulty == difficulty)
    questions = q.order_by(TechnicalQuestion.created_at.desc()).limit(100).all()
    return [QuestionPublic.model_validate(x) for x in questions]


@router.post("/{question_id}/answer", response_model=SubmitAnswerResponse)
def submit_answer(
    question_id: str,
    current_user: CurrentUser,
    data: SubmitAnswerRequest,
    db: Session = Depends(get_db),
) -> SubmitAnswerResponse:
    """Save the learner's answer and return verdict + coaching (reference answer never returned)."""
    question = db.query(TechnicalQuestion).filter(TechnicalQuestion.id == question_id).first()
    if not question:
        raise NotFoundError("Question not found")
    verdict, feedback = evaluate_learner_answer(
        question.question_text,
        question.answer_text,
        data.user_answer,
    )
    existing = db.query(UserQuestionAnswer).filter(
        UserQuestionAnswer.user_id == current_user.id,
        UserQuestionAnswer.question_id == question_id,
    ).first()
    if existing:
        existing.user_answer = data.user_answer
        db.commit()
        return SubmitAnswerResponse(message="Answer updated", verdict=verdict, feedback=feedback)
    uqa = UserQuestionAnswer(
        user_id=current_user.id,
        question_id=question_id,
        user_answer=data.user_answer,
    )
    db.add(uqa)
    db.commit()
    return SubmitAnswerResponse(message="Answer saved", verdict=verdict, feedback=feedback)


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
        if e.challenge_id in seen_challenge_ids:
            continue
        if execution_passed_challenge_tests(e):
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


@router.get("/quiz", response_model=list[QuestionPublic])
def get_quick_quiz(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    count: int = Query(5, ge=1, le=15),
) -> list[QuestionPublic]:
    """Quick quiz: random subset of technical questions (no reference answers)."""
    import random
    questions = db.query(TechnicalQuestion).order_by(TechnicalQuestion.id).limit(100).all()
    selected = random.sample(questions, min(count, len(questions))) if questions else []
    return [QuestionPublic.model_validate(q) for q in selected]


@router.get("/one/{question_id}", response_model=QuestionPublic)
def get_question_by_id(
    question_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> QuestionPublic:
    """Fetch a single question by id (e.g. deep link from level). No reference answer."""
    question = db.query(TechnicalQuestion).filter(TechnicalQuestion.id == question_id).first()
    if not question:
        raise NotFoundError("Question not found")
    return QuestionPublic.model_validate(question)
