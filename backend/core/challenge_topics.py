"""Topic slugs for coding challenges (filters, LLM output, DB JSON)."""
from __future__ import annotations

# Stable slugs — keep in sync with frontend `challengeTopics.ts`
TOPIC_SLUGS: tuple[str, ...] = (
    "arrays",
    "linked-list",
    "strings",
    "hash-table",
    "sorting",
    "trees",
    "stacks-queues",
    "binary-search",
    "graphs",
    "dynamic-programming",
    "greedy",
    "two-pointers",
    "sliding-window",
    "bit-manipulation",
    "math",
    "streams",
    "general",
)

TOPIC_SLUG_SET: frozenset[str] = frozenset(TOPIC_SLUGS)


def normalize_topics(raw: list | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for x in raw:
        if not isinstance(x, str):
            continue
        s = x.strip().lower().replace(" ", "-").replace("_", "-")
        if s in TOPIC_SLUG_SET and s not in out:
            out.append(s)
    return out


def infer_topics_from_text(title: str, description: str, skills: list | None) -> list[str]:
    """Best-effort tags for legacy rows without ``topics``."""
    blob = f"{title} {description}".lower()
    skills_l = " ".join(skills or []).lower()
    blob = f"{blob} {skills_l}"
    found: list[str] = []
    rules: list[tuple[str, tuple[str, ...]]] = [
        ("arrays", ("array", "two sum", "subarray", "prefix", "matrix")),
        ("linked-list", ("linked list", "listnode", "linkedlist")),
        ("strings", ("string", "palindrome", "anagram", "substring", "fizz")),
        ("hash-table", ("hash map", "hashmap", "dictionary", "hashtable")),
        ("sorting", ("sort", "merge sort", "quick sort", "heap")),
        ("trees", ("tree", "binary tree", "bst", "trie")),
        ("stacks-queues", ("stack", "queue", "monotonic")),
        ("binary-search", ("binary search", "bisect")),
        ("graphs", ("graph", "bfs", "dfs", "dijkstra")),
        ("dynamic-programming", ("dp", "dynamic programming", "memo")),
        ("greedy", ("greedy",)),
        ("two-pointers", ("two pointer", "two-pointer")),
        ("sliding-window", ("sliding window",)),
        ("bit-manipulation", ("bit", "xor")),
        ("math", ("math", "prime", "modulo", "gcd", "fizz")),
        ("streams", ("stream", "lambda", "collector", "optional")),
    ]
    for slug, needles in rules:
        if any(n in blob for n in needles) and slug not in found:
            found.append(slug)
    if not found:
        found.append("general")
    return found[:6]
