"""Evaluate learner answers without exposing the reference answer text to the client."""
from __future__ import annotations

import re
from typing import Literal

Verdict = Literal["correct", "partial", "needs_improvement"]


def _tokens(s: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[a-zA-Z0-9_]{2,}", s or "")}


def _heuristic(reference: str, user_answer: str) -> tuple[Verdict, str]:
    ref_t = _tokens(reference)
    user_t = _tokens(user_answer)
    if not user_t:
        return "needs_improvement", "Add a substantive answer — type it or use the microphone."
    if not ref_t:
        return "partial", "Answer saved. Try adding examples or definitions to make it stronger."
    inter = len(ref_t & user_t)
    recall = inter / len(ref_t) if ref_t else 0.0
    if recall >= 0.45 and inter >= 4:
        verdict: Verdict = "correct"
        fb = "Your answer hits the main concepts. Keep practicing concise explanations out loud."
    elif recall >= 0.22 or inter >= 2:
        verdict = "partial"
        fb = "You're partly there — add missing pieces: definitions, trade-offs, or a short example."
    else:
        verdict = "needs_improvement"
        fb = "Try again: state the core idea, then why it matters or how it behaves in practice."
    return verdict, fb


def evaluate_learner_answer(
    question_text: str,
    reference_answer: str | None,
    user_answer: str,
) -> tuple[Verdict, str]:
    """
    Return (verdict, feedback). Never include ``reference_answer`` in ``feedback`` —
    callers send feedback to the client as coaching only.
    """
    ua = (user_answer or "").strip()
    if not ua:
        return "needs_improvement", "Enter an answer (typing or voice) before checking."

    ref = (reference_answer or "").strip()
    if not ref:
        return "partial", "Answer saved. Add more technical detail next time you check."

    from services.llm_client import llm_service

    if llm_service.is_configured():
        system = """You grade interview-style answers. You will see a private reference answer.
NEVER quote it, NEVER paste it, NEVER enumerate it as bullets the user could copy.
Compare the learner's answer to the reference conceptually.
Return ONLY valid JSON (no markdown):
{"verdict": "correct" | "partial" | "needs_improvement", "feedback": "2-4 short sentences coaching the learner only."}
Rules:
- "correct": core understanding is demonstrated (different wording is fine).
- "partial": some right ideas but important gaps.
- "needs_improvement": mostly wrong, off-topic, or far too thin.
Feedback must coach without revealing the reference text."""

        user_block = (
            f"Question:\n{question_text}\n\n"
            f"Private reference (do not disclose):\n{ref}\n\n"
            f"Learner's answer:\n{ua}"
        )
        out = llm_service._call(system, user_block, response_format="json_object", temperature=0.2)
        if out and isinstance(out.get("verdict"), str) and isinstance(out.get("feedback"), str):
            v = out["verdict"].strip().lower()
            fb = str(out["feedback"]).strip()
            if v in ("correct", "partial", "needs_improvement") and fb:
                return v, fb  # type: ignore[return-value]

    return _heuristic(ref, ua)
