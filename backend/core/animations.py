"""Varin / prerendered animation topic mapping. Used by study notes and coding challenges."""

# Topic keywords -> video filename. Videos served at /animations/{filename}
# Add entries only after rendering and copying to static/animations/
ANIMATION_TOPIC_MAP: dict[str, list[str]] = {}


def match_animation(topics: list[str] | None = None, title: str | None = None) -> str | None:
    """Return animation filename if any topic/title matches, else None."""
    combined_parts = list(topics or [])
    if title:
        combined_parts.append(title)
    if not combined_parts:
        return None
    combined = " ".join(combined_parts).lower()
    for filename, keywords in ANIMATION_TOPIC_MAP.items():
        if any(kw in combined for kw in keywords):
            return filename
    return None
