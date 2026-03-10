# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/engagement_calc.py
# DESCRIPTION  : Platform-specific engagement rate formulas and benchmarks
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Platform = Literal["instagram", "tiktok", "youtube", "x"]

# ---------------------------------------------------------------------------
# Benchmark thresholds (engagement rate %)
# ---------------------------------------------------------------------------
_BENCHMARKS: dict[str, dict[str, float]] = {
    "instagram": {"excellent": 6.0, "good": 3.0},
    "tiktok":    {"excellent": 8.0, "good": 4.0},
    "youtube":   {"excellent": 5.0, "good": 2.0},
    "x":         {"excellent": 3.0, "good": 1.0},
}


@dataclass
class EngagementResult:
    platform: str
    engagement_rate: float          # percentage, e.g. 4.5
    tier: Literal["excellent", "good", "low"]
    formula_used: str


def _tier(platform: str, er: float) -> Literal["excellent", "good", "low"]:
    benchmarks = _BENCHMARKS.get(platform, {"excellent": 5.0, "good": 2.0})
    if er >= benchmarks["excellent"]:
        return "excellent"
    if er >= benchmarks["good"]:
        return "good"
    return "low"


def calculate_engagement_rate(
    platform: Platform,
    stats: dict[str, float],
) -> EngagementResult:
    """
    Calculate engagement rate using platform-specific formula.

    Args:
        platform: Social platform identifier.
        stats:    Dict of metric names → values (e.g. likes, comments, followers…).

    Returns:
        EngagementResult with er percentage and quality tier.

    Raises:
        ValueError: If required metrics are missing or denominator is zero.
    """
    er: float
    formula: str

    if platform == "instagram":
        likes = stats.get("likes", 0.0)
        comments = stats.get("comments", 0.0)
        followers = stats.get("followers", 0.0)
        if followers == 0:
            raise ValueError("followers must be > 0 for Instagram ER")
        er = (likes + comments) / followers * 100
        formula = "(likes + comments) / followers × 100"

    elif platform == "tiktok":
        likes = stats.get("likes", 0.0)
        comments = stats.get("comments", 0.0)
        shares = stats.get("shares", 0.0)
        views = stats.get("views", 0.0)
        if views == 0:
            raise ValueError("views must be > 0 for TikTok ER")
        er = (likes + comments + shares) / views * 100
        formula = "(likes + comments + shares) / views × 100"

    elif platform == "youtube":
        likes = stats.get("likes", 0.0)
        comments = stats.get("comments", 0.0)
        views = stats.get("views", 0.0)
        if views == 0:
            raise ValueError("views must be > 0 for YouTube ER")
        er = (likes + comments) / views * 100
        formula = "(likes + comments) / views × 100"

    elif platform == "x":
        likes = stats.get("likes", 0.0)
        retweets = stats.get("retweets", 0.0)
        replies = stats.get("replies", 0.0)
        impressions = stats.get("impressions", 0.0)
        if impressions == 0:
            raise ValueError("impressions must be > 0 for X ER")
        er = (likes + retweets + replies) / impressions * 100
        formula = "(likes + retweets + replies) / impressions × 100"

    else:
        raise ValueError(f"Unsupported platform: {platform}")

    return EngagementResult(
        platform=platform,
        engagement_rate=round(er, 4),
        tier=_tier(platform, er),
        formula_used=formula,
    )
