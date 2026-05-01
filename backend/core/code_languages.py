"""Supported coding-challenge languages (editor + server execution)."""
from __future__ import annotations

# Normalized language keys stored on Challenge.language and sent by the client.
ALLOWED_LANGUAGES: frozenset[str] = frozenset({"python", "javascript", "java", "cpp", "c"})

_ALIASES: dict[str, str] = {
    "js": "javascript",
    "node": "javascript",
    "nodejs": "javascript",
    "typescript": "javascript",  # execute as JS for now; editor can stay TS if we add later
    "ts": "javascript",
    "c++": "cpp",
    "cplusplus": "cpp",
    "g++": "cpp",
    "gcc": "c",
}


def normalize_language(lang: str | None) -> str:
    if not lang or not str(lang).strip():
        return "python"
    key = str(lang).strip().lower()
    return _ALIASES.get(key, key)


def is_allowed_language(lang: str | None) -> bool:
    return normalize_language(lang) in ALLOWED_LANGUAGES


def preferred_language_for_skill(skill: str | None) -> str | None:
    """Map a resume / profile skill name to a challenge language, if obvious.

    Avoids generating a Java-titled problem while assigning Python as the runtime.
    Returns None when unclear so callers can pick a default or rotate languages.
    """
    if not skill or not str(skill).strip():
        return None
    s = str(skill).strip().lower()
    if "c++" in s or "cpp" in s or "cplusplus" in s:
        return "cpp"
    if "javascript" in s or "typescript" in s or "node" in s or "react" in s or "vue" in s:
        return "javascript"
    if "java" in s and "javascript" not in s:
        return "java"
    if "python" in s:
        return "python"
    if s == "c" or s.startswith("c ") or s.endswith(" c") or " c " in f" {s} ":
        return "c"
    return None
