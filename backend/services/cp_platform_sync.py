"""Fetch and verify external competitive programming profiles (public APIs / pages only)."""
from __future__ import annotations

import re
import secrets
from typing import Any

import httpx

VERIFY_PREFIX = "EziLearnings verify:"

HTTP_HEADERS = {
    "User-Agent": "EziLearnings/1.0 (CP portfolio; +https://github.com/haptix)",
    "Accept": "application/json, text/html;q=0.9,*/*;q=0.8",
}

# Many judge sites block non-browser UAs on HTML pages (403). Use for profile HTML only.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
}

ALLOWED_PLATFORMS = frozenset(
    {"leetcode", "codeforces", "geeksforgeeks", "codechef", "atcoder", "github"}
)


def new_verify_token() -> str:
    return secrets.token_hex(8)


def verify_phrase(token: str) -> str:
    return f"{VERIFY_PREFIX} {token}"


def normalize_handle(h: str) -> str:
    return h.strip().lstrip("@").strip()


def extract_leetcode_slug(raw: str) -> str:
    """Accept bare username or full profile URL (e.g. https://leetcode.com/u/Amit-45/)."""
    s = raw.strip().lstrip("@")
    m = re.search(
        r"(?:https?://)?(?:www\.)?leetcode\.com/(?:u/)?([^/?#\s]+)",
        s,
        re.I,
    )
    if m:
        slug = m.group(1).strip().rstrip("/")
        if slug and slug.lower() not in (
            "accounts",
            "graphql",
            "problems",
            "discuss",
            "submit",
            "explore",
            "contest",
        ):
            return slug
    return normalize_handle(s)


def extract_github_handle(raw: str) -> str:
    s = raw.strip().lstrip("@")
    m = re.search(r"(?:https?://)?(?:www\.)?github\.com/([^/?#\s]+)", s, re.I)
    if m:
        return m.group(1).split("/")[0]
    return normalize_handle(s)


def extract_codeforces_handle(raw: str) -> str:
    s = raw.strip().lstrip("@")
    m = re.search(r"codeforces\.com/profile/([^/?#\s]+)", s, re.I)
    if m:
        return m.group(1)
    return normalize_handle(s)


def extract_atcoder_handle(raw: str) -> str:
    s = raw.strip().lstrip("@")
    m = re.search(r"atcoder\.jp/users/([^/?#\s]+)", s, re.I)
    if m:
        return m.group(1)
    return normalize_handle(s)


def extract_codechef_handle(raw: str) -> str:
    s = raw.strip().lstrip("@")
    m = re.search(r"codechef\.com/users/([^/?#\s]+)", s, re.I)
    if m:
        return m.group(1)
    return normalize_handle(s)


def extract_gfg_handle(raw: str) -> str:
    s = raw.strip().lstrip("@")
    m = re.search(r"geeksforgeeks\.org/user/([^/?#\s]+)", s, re.I)
    if m:
        return m.group(1).rstrip("/")
    return normalize_handle(s)


def normalize_platform_handle(platform: str, raw: str) -> str:
    p = platform.lower().strip()
    if p == "leetcode":
        return extract_leetcode_slug(raw)
    if p == "github":
        return extract_github_handle(raw)
    if p == "codeforces":
        return extract_codeforces_handle(raw)
    if p == "atcoder":
        return extract_atcoder_handle(raw)
    if p == "codechef":
        return extract_codechef_handle(raw)
    if p == "geeksforgeeks":
        return extract_gfg_handle(raw)
    return normalize_handle(raw)


def leetcode_profile_urls(handle: str) -> list[str]:
    """Try /u/ slug first (new LC URLs), then legacy /username/."""
    h = normalize_handle(handle)
    return [f"https://leetcode.com/u/{h}/", f"https://leetcode.com/{h}/"]


def profile_fetch_url(platform: str, handle: str) -> str | None:
    h = normalize_handle(handle)
    if platform == "leetcode":
        return leetcode_profile_urls(h)[0]
    if platform == "codeforces":
        return f"https://codeforces.com/profile/{h}"
    if platform == "atcoder":
        return f"https://atcoder.jp/users/{h}"
    if platform == "codechef":
        return f"https://www.codechef.com/users/{h}"
    if platform == "geeksforgeeks":
        return f"https://auth.geeksforgeeks.org/user/{h}/"
    if platform == "github":
        return None
    return None


def verify_github_bio(handle: str, token: str) -> tuple[bool, str]:
    h = normalize_handle(handle)
    phrase = verify_phrase(token)
    try:
        with httpx.Client(timeout=20.0, headers=HTTP_HEADERS) as client:
            r = client.get(f"https://api.github.com/users/{h}")
            if r.status_code == 404:
                return False, "GitHub user not found."
            if r.status_code != 200:
                return False, "Could not read GitHub profile (rate limit or network)."
            data = r.json()
            bio = (data.get("bio") or "").replace("\n", " ").replace("\r", "")
            if phrase in bio:
                return True, "Verified using your GitHub profile bio."
            return False, f'Add this exact line to your GitHub profile bio, save, then verify again:\n{phrase}'
    except httpx.RequestError as e:
        return False, f"Network error while contacting GitHub: {e}"


def verify_html_profile(platform: str, handle: str, token: str) -> tuple[bool, str]:
    url = profile_fetch_url(platform, handle)
    if not url:
        return False, "Unsupported platform for HTML verification."
    phrase = verify_phrase(token)
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True, headers=BROWSER_HEADERS) as client:
            r = client.get(url)
            if r.status_code == 404:
                return False, "Profile page not found—check your handle."
            if r.status_code != 200:
                return False, f"Could not load profile (HTTP {r.status_code}). Try again later."
            body = r.text.replace("\n", " ").replace("\r", " ")
            if phrase in body:
                return True, "Verified: token found on your public profile page."
            return False, (
                f"Token not found on your public profile. Add this text somewhere visible "
                f'(about / bio / headline), save, then verify again:\n{phrase}'
            )
    except httpx.RequestError as e:
        return False, f"Network error: {e}"


_LEETCODE_ABOUT_QUERY = """
query userProfileAbout($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      aboutMe
    }
  }
}
"""


def verify_leetcode(handle: str, token: str) -> tuple[bool, str]:
    """Prefer GraphQL aboutMe (matches user 'About' field); fall back to public HTML with two URL shapes."""
    h = normalize_platform_handle("leetcode", handle)
    phrase = verify_phrase(token)
    gql_headers = {
        **BROWSER_HEADERS,
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "Origin": "https://leetcode.com",
    }
    try:
        with httpx.Client(timeout=22.0, headers=gql_headers) as client:
            r = client.post(
                "https://leetcode.com/graphql",
                json={"query": _LEETCODE_ABOUT_QUERY, "variables": {"username": h}},
            )
            if r.status_code == 200:
                payload = r.json()
                if payload.get("errors"):
                    pass
                else:
                    mu = (payload.get("data") or {}).get("matchedUser")
                    if mu:
                        about = ((mu.get("profile") or {}).get("aboutMe") or "").replace("\n", " ").replace("\r", " ")
                        if phrase in about:
                            return True, "Verified: token found in your LeetCode profile About section."
    except httpx.RequestError:
        pass

    last_non_ok: int | None = None
    saw_200_no_phrase = False
    try:
        with httpx.Client(timeout=22.0, follow_redirects=True, headers=BROWSER_HEADERS) as client:
            for url in leetcode_profile_urls(h):
                r = client.get(url, headers={**BROWSER_HEADERS, "Referer": "https://leetcode.com/"})
                if r.status_code != 200:
                    last_non_ok = r.status_code
                    continue
                last_non_ok = None
                body = r.text.replace("\n", " ").replace("\r", " ")
                if phrase in body:
                    return True, "Verified: token found on your public LeetCode profile page."
                saw_200_no_phrase = True
            if last_non_ok == 403 and not saw_200_no_phrase:
                return (
                    False,
                    "LeetCode blocked automated access (HTTP 403). Put the verify phrase in your "
                    "LeetCode **About** section (profile settings), save, then verify again—we read that via LeetCode's API.",
                )
            if last_non_ok == 404 and not saw_200_no_phrase:
                return False, "LeetCode profile not found—check the username / slug from your profile URL."
            return False, (
                f"Token not found. Add the phrase to LeetCode **About** (recommended) or any public profile text, "
                f"then verify again:\n{phrase}"
            )
    except httpx.RequestError as e:
        return False, f"Network error: {e}"


def verify_connection(platform: str, handle: str, token: str) -> tuple[bool, str]:
    p = platform.lower().strip()
    handle = normalize_platform_handle(p, handle)
    if p == "github":
        return verify_github_bio(handle, token)
    if p == "leetcode":
        return verify_leetcode(handle, token)
    return verify_html_profile(p, handle, token)


def sync_codeforces(handle: str) -> tuple[dict[str, Any] | None, str | None]:
    h = normalize_platform_handle("codeforces", handle)
    try:
        with httpx.Client(timeout=20.0, headers=HTTP_HEADERS) as client:
            r = client.get("https://codeforces.com/api/user.info", params={"handles": h})
            if r.status_code != 200:
                return None, "Codeforces API error."
            data = r.json()
            if data.get("status") != "OK" or not data.get("result"):
                return None, data.get("comment") or "Codeforces user not found."
            u = data["result"][0]
            rating = u.get("rating")
            max_rating = u.get("maxRating")
            rank = u.get("rank")
            contrib = u.get("contribution")
            base: dict[str, Any] = {
                "source": "codeforces_api",
                "handle": u.get("handle"),
                "rating": rating,
                "max_rating": max_rating,
                "rank": rank,
                "contribution": contrib,
                "title_photo": u.get("titlePhoto"),
            }
            try:
                rh = client.get("https://codeforces.com/api/user.rating", params={"handle": h})
                if rh.status_code == 200:
                    rj = rh.json()
                    if rj.get("status") == "OK" and isinstance(rj.get("result"), list):
                        hist = rj["result"][-40:]
                        base["rating_history"] = [
                            {
                                "contest_id": x.get("contestId"),
                                "contest_name": x.get("contestName"),
                                "rank": x.get("rank"),
                                "rating_update": x.get("ratingUpdateTimeSeconds"),
                                "old_rating": x.get("oldRating"),
                                "new_rating": x.get("newRating"),
                            }
                            for x in hist
                            if isinstance(x, dict)
                        ]
            except Exception:
                pass
            return base, None
    except httpx.RequestError as e:
        return None, f"{e}"


def sync_github(handle: str) -> tuple[dict[str, Any] | None, str | None]:
    h = normalize_platform_handle("github", handle)
    try:
        with httpx.Client(timeout=20.0, headers=HTTP_HEADERS) as client:
            r = client.get(f"https://api.github.com/users/{h}")
            if r.status_code == 404:
                return None, "GitHub user not found."
            if r.status_code != 200:
                return None, "GitHub API error."
            u = r.json()
            return (
                {
                    "source": "github_api",
                    "login": u.get("login"),
                    "name": u.get("name"),
                    "public_repos": u.get("public_repos"),
                    "followers": u.get("followers"),
                    "html_url": u.get("html_url"),
                },
                None,
            )
    except httpx.RequestError as e:
        return None, str(e)


def sync_leetcode(handle: str) -> tuple[dict[str, Any] | None, str | None]:
    from services.cp_leetcode_stats import fetch_leetcode_profile_bundle

    try:
        return fetch_leetcode_profile_bundle(handle)
    except httpx.RequestError as e:
        return None, str(e)


def sync_platform_stats(platform: str, handle: str) -> tuple[dict[str, Any] | None, str | None]:
    p = platform.lower().strip()
    handle = normalize_platform_handle(p, handle)
    if p == "codeforces":
        return sync_codeforces(handle)
    if p == "github":
        return sync_github(handle)
    if p == "leetcode":
        return sync_leetcode(handle)
    if p in {"geeksforgeeks", "codechef", "atcoder"}:
        return (
            {
                "source": "placeholder",
                "platform": p,
                "note": "Detailed stats sync for this platform is not wired yet; verification still works via profile page.",
            },
            None,
        )
    return None, "Unknown platform."


def validate_public_slug(slug: str) -> tuple[bool, str]:
    s = slug.strip().lower()
    if len(s) < 3 or len(s) > 32:
        return False, "Slug must be 3–32 characters."
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", s):
        return False, "Use lowercase letters, numbers, and single hyphens only."
    reserved = frozenset(
        {"me", "api", "health", "public", "admin", "static", "avatars", "animations", "onboarding"}
    )
    if s in reserved:
        return False, "This slug is reserved."
    return True, s
