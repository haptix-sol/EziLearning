"""Code execution router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import CurrentUser, SessionDep, get_db
from core.code_languages import is_allowed_language, normalize_language
from core.exceptions import NotFoundError, ValidationError
from models import Challenge, Execution
from schemas.execution import ExecuteCodeRequest, ExecutionResponse
from services.code_executor import run_code, run_tests_for_language

router = APIRouter(prefix="/executions", tags=["executions"])


@router.post("", response_model=ExecutionResponse)
def execute_code(
    current_user: CurrentUser,
    data: ExecuteCodeRequest,
    db: Session = Depends(get_db),
) -> ExecutionResponse:
    """Submit code for execution. mode=run: execute only; mode=submit: execute + run tests."""
    lang = normalize_language(data.language)
    if not is_allowed_language(lang):
        raise ValidationError(
            f"Unsupported language {data.language!r}. Use one of: python, javascript, java, cpp, c."
        )
    exec_result = run_code(data.code, lang, timeout_seconds=30)
    test_results = None
    if data.challenge_id and data.mode == "submit":
        challenge = db.query(Challenge).filter(Challenge.id == data.challenge_id).first()
        if challenge and challenge.test_cases:
            ch_lang = normalize_language(challenge.language)
            if ch_lang != lang:
                raise ValidationError(
                    f"Editor language ({lang}) does not match challenge language ({ch_lang})."
                )
            test_results = run_tests_for_language(data.code, ch_lang, challenge.test_cases)

    execution = Execution(
        user_id=current_user.id,
        challenge_id=data.challenge_id,
        code_submitted=data.code,
        language=lang,
        status=exec_result["status"],
        stdout=exec_result.get("stdout"),
        stderr=exec_result.get("stderr"),
        test_results=test_results,
        execution_time_ms=exec_result.get("execution_time_ms"),
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return ExecutionResponse.model_validate(execution)


@router.get("/{execution_id}", response_model=ExecutionResponse)
def get_execution(
    execution_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ExecutionResponse:
    """Get execution result."""
    execution = db.query(Execution).filter(
        Execution.id == execution_id,
        Execution.user_id == current_user.id,
    ).first()
    if not execution:
        raise NotFoundError("Execution not found")
    return ExecutionResponse.model_validate(execution)
