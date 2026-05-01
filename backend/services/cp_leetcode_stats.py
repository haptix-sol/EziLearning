"""Aggregate LeetCode public GraphQL profile stats (multiple queries, merged payload)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import httpx

from services.cp_platform_sync import BROWSER_HEADERS, normalize_platform_handle

GQL_URL = "https://leetcode.com/graphql"


def _gql_headers() -> dict[str, str]:
    return {
        **BROWSER_HEADERS,
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "Origin": "https://leetcode.com",
    }


Q_USER_PROBLEMS_SOLVED = """
query userProblemsSolved($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    username
    problemsSolvedBeatsStats { difficulty percentage }
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
  }
}
"""

Q_CONTEST = """
query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
    badge { name }
  }
  userContestRankingHistory(username: $username) {
    attended
    trendDirection
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest { title startTime }
  }
}
"""

Q_SKILL = """
query skillStats($username: String!) {
  matchedUser(username: $username) {
    tagProblemCounts {
      advanced { tagName tagSlug problemsSolved }
      intermediate { tagName tagSlug problemsSolved }
      fundamental { tagName tagSlug problemsSolved }
    }
  }
}
"""

Q_LANG = """
query languageStats($username: String!) {
  matchedUser(username: $username) {
    languageProblemCount { languageName problemsSolved }
  }
}
"""

Q_CALENDAR = """
query userProfileCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      activeYears
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}
"""

Q_BADGES = """
query userBadges($username: String!) {
  matchedUser(username: $username) {
    badges {
      id name shortName displayName icon hoverText
      creationDate category
    }
    upcomingBadges { name icon progress }
  }
"""

Q_RECENT = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id title titleSlug timestamp
  }
}
"""

Q_PUBLIC_PROFILE = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    contestBadge { name expired hoverText icon }
    profile {
      ranking userAvatar realName reputation reputationDiff
      solutionCount solutionCountDiff postViewCount
    }
  }
}
"""


def _post_gql(client: httpx.Client, query: str, variables: dict[str, Any]) -> dict[str, Any] | None:
    try:
        r = client.post(GQL_URL, json={"query": query, "variables": variables})
        if r.status_code != 200:
            return None
        payload = r.json()
        if payload.get("errors") and not payload.get("data"):
            return None
        return payload.get("data") or {}
    except Exception:
        return None


def _calendar_count_value(v: Any) -> int:
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return 0


def _parse_submission_calendar(raw: Any) -> dict[str, int]:
    """LeetCode returns submissionCalendar as JSON with **Unix epoch (seconds) keys**, not YYYY-MM-DD."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        m: dict[Any, Any] = raw
    elif isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        try:
            parsed = json.loads(s)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}
        m = parsed
    else:
        return {}

    out: dict[str, int] = {}
    for k, v in m.items():
        c = _calendar_count_value(v)
        if c <= 0:
            continue
        sk = str(k).strip()
        date_key: str | None = None
        if sk.isdigit():
            ts = int(sk)
            if ts > 1_000_000_000_000:
                ts //= 1000
            try:
                date_key = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            except (OSError, OverflowError, ValueError):
                continue
        elif len(sk) >= 10 and sk[4] == "-" and sk[7] == "-":
            date_key = sk[:10]
        if date_key:
            out[date_key] = out.get(date_key, 0) + c
    return out


def _trim_daily_submissions(cal: dict[str, int], max_days: int = 420) -> dict[str, int]:
    if len(cal) <= max_days:
        return cal
    keys = sorted(cal.keys())[-max_days:]
    return {k: cal[k] for k in keys}


def fetch_leetcode_profile_bundle(username: str) -> tuple[dict[str, Any] | None, str | None]:
    h = normalize_platform_handle("leetcode", username)
    if not h:
        return None, "Empty username."

    year = datetime.now(timezone.utc).year
    out: dict[str, Any] = {
        "source": "leetcode_graphql",
        "username": h,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }

    with httpx.Client(timeout=35.0, headers=_gql_headers()) as client:
        d1 = _post_gql(client, Q_USER_PROBLEMS_SOLVED, {"username": h})
        if not d1 or not d1.get("matchedUser"):
            return None, "LeetCode user not found or API restricted."

        mu = d1["matchedUser"]
        out["username"] = mu.get("username") or h
        ac = ((mu.get("submitStatsGlobal") or {}).get("acSubmissionNum")) or []
        by_diff: dict[str, int] = {}
        for row in ac:
            d = (row.get("difficulty") or "all").lower()
            by_diff[d] = int(row.get("count") or 0)
        out["solved_by_difficulty"] = by_diff
        out["beats_by_difficulty"] = mu.get("problemsSolvedBeatsStats") or []
        out["all_questions_count"] = d1.get("allQuestionsCount") or []

        d2 = _post_gql(client, Q_CONTEST, {"username": h})
        if d2:
            ucr = d2.get("userContestRanking")
            if ucr:
                out["contest"] = {
                    "rating": ucr.get("rating"),
                    "global_ranking": ucr.get("globalRanking"),
                    "total_participants": ucr.get("totalParticipants"),
                    "top_percentage": ucr.get("topPercentage"),
                    "attended_contests_count": ucr.get("attendedContestsCount"),
                    "badge_name": (ucr.get("badge") or {}).get("name") if isinstance(ucr.get("badge"), dict) else None,
                }
            hist = d2.get("userContestRankingHistory") or []
            if isinstance(hist, list):
                hist_sorted = sorted(
                    [x for x in hist if isinstance(x, dict)],
                    key=lambda x: int((x.get("contest") or {}).get("startTime") or 0),
                    reverse=True,
                )[:30]
                out["contest_history"] = hist_sorted

        d3 = _post_gql(client, Q_SKILL, {"username": h})
        topics: list[dict[str, Any]] = []
        if d3 and d3.get("matchedUser"):
            tpc = (d3["matchedUser"].get("tagProblemCounts")) or {}
            for tier in ("advanced", "intermediate", "fundamental"):
                for t in tpc.get(tier) or []:
                    if not isinstance(t, dict):
                        continue
                    topics.append(
                        {
                            "tag": t.get("tagName"),
                            "slug": t.get("tagSlug"),
                            "solved": int(t.get("problemsSolved") or 0),
                            "tier": tier,
                        }
                    )
        topics.sort(key=lambda x: -x["solved"])
        out["tag_topics"] = topics[:60]

        d4 = _post_gql(client, Q_LANG, {"username": h})
        if d4 and d4.get("matchedUser"):
            langs = d4["matchedUser"].get("languageProblemCount") or []
            out["languages"] = langs if isinstance(langs, list) else []

        merged_cal: dict[str, int] = {}
        streak = None
        total_days = None
        active_years: list[Any] = []
        for y in (year, year - 1):
            d5 = _post_gql(client, Q_CALENDAR, {"username": h, "year": y})
            if not d5 or not d5.get("matchedUser"):
                continue
            uc = (d5["matchedUser"].get("userCalendar")) or {}
            if streak is None:
                streak = uc.get("streak")
            if total_days is None:
                total_days = uc.get("totalActiveDays")
            if not active_years:
                active_years = uc.get("activeYears") or []
            part = _parse_submission_calendar(uc.get("submissionCalendar"))
            for dk, dv in part.items():
                merged_cal[dk] = merged_cal.get(dk, 0) + dv
        out["calendar"] = {
            "years_fetched": [year, year - 1],
            "streak": streak,
            "total_active_days": total_days,
            "active_years": active_years,
            "daily_submissions": _trim_daily_submissions(merged_cal),
        }

        out.setdefault("badges", [])
        out.setdefault("upcoming_badges", [])
        d6 = _post_gql(client, Q_BADGES, {"username": h})
        if d6 and d6.get("matchedUser"):
            badges = d6["matchedUser"].get("badges") or []
            upcoming = d6["matchedUser"].get("upcomingBadges") or []
            out["badges"] = badges[:24] if isinstance(badges, list) else []
            out["upcoming_badges"] = upcoming[:12] if isinstance(upcoming, list) else []

        d7 = _post_gql(client, Q_RECENT, {"username": h, "limit": 20})
        if d7:
            out["recent_ac"] = d7.get("recentAcSubmissionList") or []

        d8 = _post_gql(client, Q_PUBLIC_PROFILE, {"username": h})
        if d8 and d8.get("matchedUser"):
            mu8 = d8["matchedUser"]
            prof = mu8.get("profile") or {}
            out["profile"] = {
                "ranking": prof.get("ranking"),
                "reputation": prof.get("reputation"),
                "reputation_diff": prof.get("reputationDiff"),
                "solution_count": prof.get("solutionCount"),
                "solution_count_diff": prof.get("solutionCountDiff"),
                "post_view_count": prof.get("postViewCount"),
                "avatar": prof.get("userAvatar"),
                "real_name": prof.get("realName"),
            }
            cb = mu8.get("contestBadge")
            if isinstance(cb, dict) and cb.get("name"):
                out["contest_badge"] = cb

    return out, None
