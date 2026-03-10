# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/pricing_calc.py
# DESCRIPTION  : Influencer price estimation with niche multipliers
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ContentType = Literal["post", "story", "reel", "video", "thread", "article"]
Platform = Literal["instagram", "tiktok", "youtube", "x", "linkedin"]

# ---------------------------------------------------------------------------
# Base CPM rates (EUR per 1 000 followers) by platform + content type
# ---------------------------------------------------------------------------
_BASE_CPM: dict[str, dict[str, float]] = {
    "instagram": {"post": 10.0, "story": 5.0, "reel": 14.0},
    "tiktok":    {"post": 12.0, "video": 16.0, "story": 6.0},
    "youtube":   {"video": 20.0, "post": 8.0},
    "x":         {"thread": 6.0, "post": 4.0},
    "linkedin":  {"article": 18.0, "post": 10.0},
}

_DEFAULT_CPM = 8.0

# ---------------------------------------------------------------------------
# Niche multipliers
# ---------------------------------------------------------------------------
_NICHE_MULTIPLIERS: dict[str, float] = {
    "finance":    3.0,
    "crypto":     3.0,
    "b2b":        2.5,
    "tech":       2.5,
    "beauty":     1.8,
    "lifestyle":  1.8,
    "gaming":     1.5,
    "food":       1.3,
    "travel":     1.3,
    "general":    1.0,
}

# ---------------------------------------------------------------------------
# Engagement rate bonus (applied on top of base)
# ---------------------------------------------------------------------------
def _er_bonus(er: float) -> float:
    if er >= 8.0:
        return 1.5
    if er >= 5.0:
        return 1.25
    if er >= 3.0:
        return 1.1
    return 1.0


@dataclass
class PriceEstimate:
    min_price: float
    max_price: float
    currency: str = "EUR"
    breakdown: dict[str, float] = field(default_factory=dict)


def estimate_influencer_price(
    platform: Platform,
    followers: int,
    er: float,
    niche: str,
    content_type: ContentType,
) -> PriceEstimate:
    """
    Estimate an influencer's price range for a sponsored post.

    Args:
        platform:     Social platform.
        followers:    Total follower count.
        er:           Engagement rate (%).
        niche:        Content niche (key from NICHE_MULTIPLIERS or free text).
        content_type: Type of content.

    Returns:
        PriceEstimate with min/max in EUR.
    """
    platform_rates = _BASE_CPM.get(platform, {})
    cpm = platform_rates.get(content_type, _DEFAULT_CPM)

    niche_key = niche.lower().split("/")[0].strip()
    niche_mult = _NICHE_MULTIPLIERS.get(niche_key, 1.0)

    er_mult = _er_bonus(er)

    base_price = (followers / 1_000) * cpm * niche_mult * er_mult
    min_price = round(base_price * 0.8, 2)
    max_price = round(base_price * 1.5, 2)

    return PriceEstimate(
        min_price=min_price,
        max_price=max_price,
        currency="EUR",
        breakdown={
            "base_price": round(base_price, 2),
            "cpm": cpm,
            "niche_multiplier": niche_mult,
            "er_multiplier": er_mult,
            "followers_k": round(followers / 1_000, 2),
        },
    )
