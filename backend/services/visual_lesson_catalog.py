"""Daily Lesson Visual Explainer — structured lesson manifests (sample + fallback)."""
from __future__ import annotations

import copy
import hashlib
import re
from typing import Any


def topic_key(topic: str) -> str:
    t = (topic or "").strip().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-")[:200] or "topic"


def _slide(
    sid: str,
    kind: str,
    title: str,
    *,
    short: str = "",
    diagram_type: str = "generic",
    diagram_data: dict[str, Any] | None = None,
    code_example: dict[str, Any] | None = None,
    highlight_targets: list[str] | None = None,
    animation_sequence: dict[str, Any] | None = None,
    narration_text: str = "",
    audio_url: str | None = None,
    caption_keywords: list[str] | None = None,
    checkpoint_question: str | None = None,
    checkpoint_options: list[str] | None = None,
    checkpoint_answer_index: int | None = None,
    summary_points: list[str] | None = None,
    quiz: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": sid,
        "kind": kind,
        "title": title,
        "short_explanation": short,
        "diagram_type": diagram_type,
        "diagram_data": diagram_data or {},
        "code_example": code_example,
        "highlight_targets": highlight_targets or [],
        "animation_sequence": animation_sequence or {"steps": [{"id": "default", "reveal_ids": [], "highlight_ids": []}]},
        "narration_text": narration_text,
        "audio_url": audio_url,
        "caption_keywords": caption_keywords or [],
        "checkpoint_question": checkpoint_question,
        "checkpoint_options": checkpoint_options,
        "checkpoint_answer_index": checkpoint_answer_index,
        "summary_points": summary_points,
        "quiz": quiz,
    }


def _lesson_loops(topic: str, day_title: str) -> dict[str, Any]:
    tk = topic_key(topic)
    return {
        "lesson_title": topic,
        "lesson_objective": "See how a loop repeats work with a clear control flow and state mental model.",
        "lesson_type": "programming",
        "topic_key": tk,
        "day_context": day_title,
        "slides": [
            _slide(
                "intro",
                "intro",
                "Today on the board",
                short="A focused walkthrough — visuals first, narration optional.",
                diagram_type="box_arrow",
                diagram_data={
                    "boxes": [
                        {"id": "b1", "label": "Goal", "x": 40, "y": 60, "w": 120, "h": 56},
                        {"id": "b2", "label": "Loop", "x": 220, "y": 60, "w": 120, "h": 56},
                        {"id": "b3", "label": "Outcome", "x": 400, "y": 60, "w": 120, "h": 56},
                    ],
                    "arrows": [{"from": "b1", "to": "b2"}, {"from": "b2", "to": "b3"}],
                },
                caption_keywords=["structure", "repeat", "flow"],
                narration_text="Welcome. We will read this board like a classroom: one idea per card, diagrams lead, words support.",
            ),
            _slide(
                "objectives",
                "objectives",
                "What you will learn",
                short="Condition • body • progression • termination",
                diagram_type="step_chain",
                diagram_data={
                    "steps": [
                        {"id": "s1", "label": "Start"},
                        {"id": "s2", "label": "Check"},
                        {"id": "s3", "label": "Act"},
                        {"id": "s4", "label": "Advance"},
                    ]
                },
                caption_keywords=["check", "body", "advance"],
                narration_text="You will learn the four beats of every loop: start, check the condition, act in the body, advance state.",
            ),
            _slide(
                "concept",
                "concept",
                "Concept overview",
                short="A loop is controlled repetition",
                diagram_type="ipo",
                diagram_data={
                    "input_label": "Setup",
                    "process_label": "Repeated work",
                    "output_label": "Finished state",
                },
                animation_sequence={
                    "steps": [
                        {"id": "a1", "highlight_ids": ["process"], "dim_ids": ["output"]},
                        {"id": "a2", "highlight_ids": ["input", "process"], "dim_ids": []},
                        {"id": "a3", "highlight_ids": ["output"], "dim_ids": ["input"]},
                    ]
                },
                caption_keywords=["input", "process", "output"],
                narration_text="Think input process output: setup values, repeat the middle until the stop rule wins, then exit.",
            ),
            _slide(
                "step-1",
                "step",
                "Step 1 — The condition is the gate",
                short="True opens the body. False exits.",
                diagram_type="flowchart",
                diagram_data={
                    "nodes": [
                        {"id": "n1", "label": "Condition", "kind": "diamond", "x": 200, "y": 40},
                        {"id": "n2", "label": "Body", "kind": "rect", "x": 320, "y": 140},
                        {"id": "n3", "label": "After loop", "kind": "rect", "x": 80, "y": 140},
                    ],
                    "edges": [
                        {"from": "n1", "to": "n2", "label": "true"},
                        {"from": "n1", "to": "n3", "label": "false"},
                    ],
                },
                caption_keywords=["gate", "true", "false"],
                narration_text="The condition is the gate. True means enter the body once more. False means jump out to what comes after.",
            ),
            _slide(
                "step-2",
                "step",
                "Step 2 — Progress inside the body",
                short="Change something toward exit",
                diagram_type="memory_state",
                diagram_data={
                    "vars": [
                        {"name": "i", "before": "0", "after": "1"},
                        {"name": "sum", "before": "0", "after": "sum + value"},
                    ]
                },
                caption_keywords=["state", "increment"],
                narration_text="Inside the body, update state that moves you toward termination so the loop cannot run forever.",
            ),
            _slide(
                "code",
                "code",
                "Code walkthrough",
                short="Read top to bottom like the board",
                diagram_type="code_board",
                diagram_data={"frame_caption": "Python style example"},
                code_example={
                    "language": "python",
                    "code": "total = 0\nfor i in range(3):\n    total += i\n# total is 3",
                    "highlight_lines": [2, 3],
                },
                highlight_targets=["for", "range", "total"],
                caption_keywords=["for", "range", "accumulator"],
                narration_text="Here total accumulates while i walks 0 1 2. Trace numbers in your head: watch total grow each pass.",
            ),
            _slide(
                "trace",
                "step",
                "Algorithm trace",
                short="Table view of each iteration",
                diagram_type="algorithm_trace",
                diagram_data={
                    "columns": ["i", "total"],
                    "rows": [
                        {"i": "0", "total": "0"},
                        {"i": "1", "total": "1"},
                        {"i": "2", "total": "3"},
                    ],
                    "active_row": 1,
                },
                animation_sequence={
                    "steps": [
                        {"id": "t0", "highlight_ids": ["row-0"]},
                        {"id": "t1", "highlight_ids": ["row-1"]},
                        {"id": "t2", "highlight_ids": ["row-2"]},
                    ]
                },
                caption_keywords=["trace", "iteration"],
                narration_text="Trace view highlights one row at a time. This is the same story as the code, just friendlier for memory.",
            ),
            _slide(
                "summary",
                "summary",
                "Mental model",
                short="Gate • body • progress • exit",
                diagram_type="generic",
                diagram_data={"bullets": ["Condition gates repeats", "Body performs work", "State must advance", "False exits"]},
                summary_points=[
                    "A loop is repeated gated work.",
                    "Always ensure progress toward exit.",
                ],
                caption_keywords=["mental model"],
                narration_text="Carry one mental model: a gate, a workspace, forward motion, then exit.",
            ),
            _slide(
                "checkpoint",
                "checkpoint",
                "Checkpoint",
                short="Pick the best description",
                diagram_type="generic",
                diagram_data={"prompt": "Which line is the gate?"},
                checkpoint_question="What does the loop condition control?",
                checkpoint_options=["How many times print runs", "Whether another iteration runs", "Variable names only"],
                checkpoint_answer_index=1,
                caption_keywords=["check understanding"],
                narration_text="Quick checkpoint: the condition decides whether another iteration runs.",
            ),
            _slide(
                "recap",
                "recap",
                "Quick recap",
                short="You can replay any card from the rail",
                diagram_type="step_chain",
                diagram_data={"steps": [{"id": "r1", "label": "Gate"}, {"id": "r2", "label": "Body"}, {"id": "r3", "label": "Trace"}]},
                caption_keywords=["replay", "practice"],
                narration_text="Recap. Use previous and next on the rail, or keyboard arrows. Replay builds fluency faster than skimming.",
            ),
            _slide(
                "practice",
                "practice",
                "Optional practice",
                short="Mini quiz — one concept",
                diagram_type="generic",
                diagram_data={},
                quiz={
                    "question": "Which pattern prevents an infinite loop?",
                    "options": [
                        "Never changing the loop variable",
                        "Advancing state toward the exit condition",
                        "Removing the condition",
                    ],
                    "answer_index": 1,
                },
                caption_keywords=["quiz", "safety"],
                narration_text="Optional practice. The safe pattern always advances state toward the exit.",
            ),
        ],
    }


def _lesson_http(topic: str, day_title: str) -> dict[str, Any]:
    tk = topic_key(topic)
    return {
        "lesson_title": topic,
        "lesson_objective": "See request travel, server work, and response return as a lifecycle you can reuse for any API.",
        "lesson_type": "technical",
        "topic_key": tk,
        "day_context": day_title,
        "slides": [
            _slide(
                "intro",
                "intro",
                "Guided visual mode",
                short="Lifecycle thinking beats memorizing jargon",
                diagram_type="request_response",
                diagram_data={
                    "client": {"label": "Client"},
                    "server": {"label": "Server"},
                    "arrow_out": {"label": "Request"},
                    "arrow_back": {"label": "Response"},
                },
                caption_keywords=["lifecycle", "client", "server"],
                narration_text="Guided visual mode. We will move across the board like a story: who talks first, what crosses the wire, what comes back.",
            ),
            _slide(
                "objectives",
                "objectives",
                "What you will learn",
                short="Request • processing • response • status",
                diagram_type="ipo",
                diagram_data={
                    "input_label": "Request",
                    "process_label": "Server logic",
                    "output_label": "Response",
                },
                caption_keywords=["IPO", "API"],
                narration_text="You will map IPO onto HTTP: request in, processing in the middle, response out.",
            ),
            _slide(
                "overview",
                "concept",
                "Concept overview",
                short="Two directions, one contract",
                diagram_type="request_response",
                diagram_data={
                    "client": {"label": "Your app"},
                    "server": {"label": "Service"},
                    "arrow_out": {"label": "JSON / params"},
                    "arrow_back": {"label": "JSON + status"},
                },
                animation_sequence={
                    "steps": [
                        {"id": "p1", "highlight_ids": ["arrow_out"], "dim_ids": ["arrow_back"]},
                        {"id": "p2", "highlight_ids": ["server"], "dim_ids": []},
                        {"id": "p3", "highlight_ids": ["arrow_back"], "dim_ids": ["arrow_out"]},
                    ]
                },
                caption_keywords=["contract", "payload"],
                narration_text="Two arrows, one contract. Outbound carries intent. Inbound carries outcome and machine readable status.",
            ),
            _slide(
                "step-dns",
                "step",
                "Step — Addressing",
                short="URL resolves to a host",
                diagram_type="box_arrow",
                diagram_data={
                    "boxes": [
                        {"id": "u", "label": "URL", "x": 60, "y": 70, "w": 100, "h": 50},
                        {"id": "h", "label": "Host", "x": 220, "y": 70, "w": 120, "h": 50},
                        {"id": "r", "label": "Route", "x": 400, "y": 70, "w": 120, "h": 50},
                    ],
                    "arrows": [{"from": "u", "to": "h"}, {"from": "h", "to": "r"}],
                },
                caption_keywords=["URL", "host", "route"],
                narration_text="Step one on the board: the URL resolves to a host, then routing picks the handler.",
            ),
            _slide(
                "step-status",
                "step",
                "Step — Status codes signal meaning",
                short="2xx success • 4xx client • 5xx server",
                diagram_type="before_after",
                diagram_data={
                    "before": {"title": "Ambiguous", "body": "?"},
                    "after": {"title": "Structured", "body": "200 / 404 / 500"},
                },
                caption_keywords=["2xx", "4xx", "5xx"],
                narration_text="Status codes are signals. Two hundreds mean success, four hundreds usually mean fix the request, five hundreds mean investigate the service.",
            ),
            _slide(
                "code",
                "code",
                "Example call",
                short="Fetch is request + await response",
                diagram_type="code_board",
                diagram_data={"frame_caption": "JavaScript fetch"},
                code_example={
                    "language": "javascript",
                    "code": "const res = await fetch('/api/health');\nconst data = await res.json();\n// use data",
                    "highlight_lines": [0, 1],
                },
                caption_keywords=["fetch", "await", "json"],
                narration_text="Example on the board. Fetch sends the request line and headers. Await pauses until the response arrives, then you parse the body.",
            ),
            _slide(
                "summary",
                "summary",
                "Mental model",
                short="Out • work • back",
                diagram_type="flowchart",
                diagram_data={
                    "nodes": [
                        {"id": "a", "label": "Compose request", "kind": "rect", "x": 60, "y": 80},
                        {"id": "b", "label": "Transport", "kind": "rect", "x": 220, "y": 80},
                        {"id": "c", "label": "Server work", "kind": "rect", "x": 380, "y": 80},
                        {"id": "d", "label": "Interpret response", "kind": "rect", "x": 220, "y": 200},
                    ],
                    "edges": [
                        {"from": "a", "to": "b"},
                        {"from": "b", "to": "c"},
                        {"from": "c", "to": "d"},
                    ],
                },
                summary_points=["Treat every call as a round trip story.", "Always read status before assuming success."],
                caption_keywords=["round trip"],
                narration_text="Mental model: compose, transport, server work, interpret. Say it once per API you learn.",
            ),
            _slide(
                "checkpoint",
                "checkpoint",
                "Checkpoint",
                short="One decision",
                checkpoint_question="A 404 usually means…",
                checkpoint_options=["The server crashed", "The route or resource was not found", "Auth succeeded"],
                checkpoint_answer_index=1,
                caption_keywords=["404"],
                narration_text="Checkpoint. Four oh four usually means the route or resource was not found.",
            ),
            _slide(
                "recap",
                "recap",
                "Quick recap",
                short="Visual first, text supports",
                diagram_type="generic",
                diagram_data={"bullets": ["Request out", "Server processes", "Response in", "Read status"]},
                caption_keywords=["recap"],
                narration_text="Recap. Keep diagrams primary. Let labels be short. Replay the arrows until the story feels automatic.",
            ),
        ],
    }


def _fallback(topic: str, day_title: str) -> dict[str, Any]:
    tk = topic_key(topic)
    return {
        "lesson_title": topic,
        "lesson_objective": f"Build a clear picture of “{topic}” in the context of {day_title}.",
        "lesson_type": "general",
        "topic_key": tk,
        "day_context": day_title,
        "slides": [
            _slide(
                "intro",
                "intro",
                "Topic intro",
                short="Micro-lesson on the board",
                diagram_type="generic",
                diagram_data={"headline": topic, "sub": day_title},
                caption_keywords=["focus", "pace"],
                narration_text="Topic intro. We move one idea per card so the board stays readable.",
            ),
            _slide(
                "objectives",
                "objectives",
                "What you will learn",
                short="Definition • use case • pitfall",
                diagram_type="step_chain",
                diagram_data={"steps": [{"id": "o1", "label": "Define"}, {"id": "o2", "label": "Apply"}, {"id": "o3", "label": "Check"}]},
                caption_keywords=["define", "apply"],
                narration_text="What you will learn: a crisp definition, a realistic use case, and a common pitfall to avoid.",
            ),
            _slide(
                "concept",
                "concept",
                "Concept overview",
                short="Big picture before details",
                diagram_type="ipo",
                diagram_data={"input_label": "Inputs", "process_label": topic, "output_label": "Outcome"},
                caption_keywords=["overview"],
                narration_text="Concept overview. Inputs enter your process, the topic names the transformation, outcome is what you can measure.",
            ),
            _slide(
                "step-1",
                "step",
                "Step 1 — Name the moving parts",
                short="Actors and artifacts",
                diagram_type="box_arrow",
                diagram_data={
                    "boxes": [
                        {"id": "x1", "label": "Actor A", "x": 60, "y": 80, "w": 110, "h": 52},
                        {"id": "x2", "label": "Work", "x": 220, "y": 80, "w": 110, "h": 52},
                        {"id": "x3", "label": "Artifact", "x": 380, "y": 80, "w": 120, "h": 52},
                    ],
                    "arrows": [{"from": "x1", "to": "x2"}, {"from": "x2", "to": "x3"}],
                },
                caption_keywords=["actors"],
                narration_text="Step one: name the moving parts. Who acts, what work happens, what artifact proves progress.",
            ),
            _slide(
                "step-2",
                "step",
                "Step 2 — Trace one happy path",
                short="Single golden scenario",
                diagram_type="flowchart",
                diagram_data={
                    "nodes": [
                        {"id": "f1", "label": "Start", "kind": "rect", "x": 80, "y": 60},
                        {"id": "f2", "label": "Core step", "kind": "rect", "x": 240, "y": 60},
                        {"id": "f3", "label": "Done", "kind": "rect", "x": 400, "y": 60},
                    ],
                    "edges": [{"from": "f1", "to": "f2"}, {"from": "f2", "to": "f3"}],
                },
                caption_keywords=["happy path"],
                narration_text="Step two: trace one happy path. If you cannot draw it, you do not yet understand it simply enough.",
            ),
            _slide(
                "summary",
                "summary",
                "Summary",
                short="Carry one sentence",
                diagram_type="generic",
                diagram_data={"bullets": ["Define the outcome", "Draw the path", "Test with one example"]},
                summary_points=[f"{topic} is easier when you can sketch it in under ten seconds."],
                caption_keywords=["summary"],
                narration_text="Summary. Carry one sentence you could teach a teammate on a napkin.",
            ),
            _slide(
                "checkpoint",
                "checkpoint",
                "Checkpoint",
                short="Confidence check",
                checkpoint_question="Which habit helps most for new topics?",
                checkpoint_options=["Skip diagrams", "Sketch one happy path", "Memorize buzzwords only"],
                checkpoint_answer_index=1,
                caption_keywords=["habit"],
                narration_text="Checkpoint. Sketching one happy path beats memorizing buzzwords.",
            ),
            _slide(
                "recap",
                "recap",
                "Quick recap",
                short="Replay beats skimming",
                diagram_type="generic",
                diagram_data={"bullets": ["One idea per card", "Replay weak spots", "Teach it aloud"]},
                caption_keywords=["recap"],
                narration_text="Recap. Replay any card. Teaching aloud reveals gaps faster than rereading.",
            ),
        ],
    }


def resolve_visual_manifest(day_title: str, topic: str) -> dict[str, Any]:
    """Pick a rich sample when topic matches known patterns; else fallback."""
    raw = f"{topic} {day_title}".lower()
    if any(k in raw for k in ("loop", "for ", "while", "iteration", "enumerate")):
        return _lesson_loops(topic, day_title)
    if any(k in raw for k in ("http", "api", "rest", "request", "response", "fetch", "client", "server")):
        return _lesson_http(topic, day_title)
    return _fallback(topic, day_title)


def _seed_mod(day_id: str, topic: str, *parts: str, mod: int) -> int:
    if mod <= 0:
        return 0
    h = hashlib.sha256(f"{day_id}|{topic}|{'|'.join(parts)}".encode()).digest()
    return int.from_bytes(h[:4], "big") % mod


def personalize_visual_manifest(
    base: dict[str, Any],
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
    subtopics: list[str] | None,
) -> dict[str, Any]:
    """Per-day / per-topic lesson: inject plan context so the same template family is not generic."""
    out = copy.deepcopy(base)
    subs = [s.strip() for s in (subtopics or []) if isinstance(s, str) and s.strip()]
    st_line = "; ".join(subs[:10]) if subs else ""
    out["topic_key"] = topic_key(topic)
    out["day_context"] = day_title
    out["lesson_title"] = f"Day {day_number} · {topic}"
    obj = (out.get("lesson_objective") or "").strip()
    if subs:
        out["lesson_objective"] = f"{obj} Your plan calls out: {st_line}."
    else:
        out["lesson_objective"] = f"{obj} Day: {day_title} (mode: {activity_type})."

    slides = out.get("slides") or []
    for i, sl in enumerate(slides):
        if not isinstance(sl, dict):
            continue
        kind = sl.get("kind") or ""
        nt = (sl.get("narration_text") or "").strip()
        if subs and kind in ("intro", "objectives", "summary", "recap"):
            focus = subs[i % len(subs)]
            extra = f' Tie this card to “{focus}” from your day outline.'
            sl["narration_text"] = f"{nt}{extra}" if nt else extra.strip()
        elif subs and kind == "checkpoint":
            focus = subs[_seed_mod(day_id, topic, str(sl.get("id", "")), mod=len(subs))]
            q = sl.get("checkpoint_question") or ""
            if q and focus.lower() not in q.lower():
                sl["checkpoint_question"] = f"{q} (hint: {focus})"
        short = (sl.get("short_explanation") or "").strip()
        if subs and short and kind in ("intro", "concept", "step", "objectives"):
            tag = subs[_seed_mod(day_id, topic, "short", str(i), mod=len(subs))]
            if tag.lower() not in short.lower():
                sl["short_explanation"] = f"{short} · {tag}"
    return out


def build_visual_lesson_manifest(
    *,
    day_id: str,
    day_number: int,
    day_title: str,
    activity_type: str,
    topic: str,
    subtopics: list[str] | None,
) -> dict[str, Any]:
    base = resolve_visual_manifest(day_title, topic)
    return personalize_visual_manifest(
        base,
        day_id=day_id,
        day_number=day_number,
        day_title=day_title,
        activity_type=activity_type or "study",
        topic=topic,
        subtopics=subtopics,
    )


def all_topic_keys_for_day(topics: list | None) -> list[str]:
    out: list[str] = []
    for t in topics or []:
        if isinstance(t, str) and t.strip():
            out.append(topic_key(t))
        elif isinstance(t, dict) and t.get("name"):
            out.append(topic_key(str(t["name"])))
    return out
