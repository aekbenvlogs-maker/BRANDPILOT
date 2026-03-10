# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/service.py
# DESCRIPTION  : Audience insights orchestration service
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any

from loguru import logger
from sqlalchemy import text

from database.connection import db_session
from microservices.bs_audience_insights.engagement_calc import (
    Platform,
    calculate_engagement_rate,
)
from microservices.bs_audience_insights.platform_analyzers import (
    PlatformStats,
    get_platform_stats,
)
from microservices.bs_audience_insights.pricing_calc import estimate_influencer_price
from microservices.bs_audience_insights.best_time_engine import get_best_posting_times


@dataclass
class AudienceInsights:
    social_account_id: str
    platform: str
    stats: dict[str, Any]
    engagement_rate: float
    engagement_tier: str
    price_estimate: dict[str, Any]
    best_times: dict[str, Any]
    confidence: str


@dataclass
class InfluencerAnalysis:
    username: str
    platform: str
    followers: int
    engagement_rate: float
    engagement_tier: str
    estimated_price: dict[str, Any]
    best_times: dict[str, Any]
    niche: str


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def analyze_social_account(
    social_account_id: str,
    niche: str = "general",
    content_type: str = "post",
) -> AudienceInsights:
    """
    Fetch stats for a connected social account and compute insights.

    Args:
        social_account_id: UUID of the social_accounts row.
        niche:             Content niche for price estimation.
        content_type:      Content type for price estimation.

    Returns:
        AudienceInsights dataclass with all computed metrics.
    """
    async with db_session() as session:
        row = await session.execute(
            text("SELECT * FROM social_accounts WHERE id = :id"),
            {"id": social_account_id},
        )
        account = row.mappings().first()

    if not account:
        raise ValueError(f"Social account {social_account_id} not found")

    account_dict = dict(account)
    platform: Platform = account_dict["platform"]

    # 1. Fetch platform stats
    stats: PlatformStats = await get_platform_stats(account_dict)

    # 2. Engagement rate
    er_stats: dict[str, Any] = {
        "followers": stats.followers,
        "likes": stats.avg_likes,
        "comments": stats.avg_comments,
        "views": stats.avg_views,
        "shares": stats.avg_shares,
    }
    er_result = calculate_engagement_rate(platform, er_stats)

    # 3. Price estimate
    price = estimate_influencer_price(
        platform=platform,
        followers=stats.followers,
        er=er_result.engagement_rate,
        niche=niche,
        content_type=content_type,  # type: ignore[arg-type]
    )

    # 4. Best posting times
    best_times = get_best_posting_times(platform)

    # 5. Persist to influencer_analyses
    await _persist_insights(
        social_account_id=social_account_id,
        project_id=account_dict["project_id"],
        platform=platform,
        stats=stats,
        er=er_result.engagement_rate,
    )

    return AudienceInsights(
        social_account_id=social_account_id,
        platform=platform,
        stats=asdict(stats),
        engagement_rate=er_result.engagement_rate,
        engagement_tier=er_result.tier,
        price_estimate=asdict(price),
        best_times=asdict(best_times),
        confidence=stats.confidence,
    )


async def analyze_influencer(
    username: str,
    platform: Platform,
    followers: int,
    avg_likes: float,
    avg_comments: float,
    avg_views: float = 0.0,
    niche: str = "general",
) -> InfluencerAnalysis:
    """
    Compute insights for a third-party influencer (no OAuth required).

    Args:
        username:     Influencer handle.
        platform:     Social platform.
        followers:    Follower count.
        avg_likes:    Average likes per post.
        avg_comments: Average comments per post.
        avg_views:    Average views per post (for video platforms).
        niche:        Content niche.

    Returns:
        InfluencerAnalysis dataclass.
    """
    er_stats = {
        "followers": followers,
        "likes": avg_likes,
        "comments": avg_comments,
        "views": avg_views,
    }
    er_result = calculate_engagement_rate(platform, er_stats)

    content_type = "video" if platform in ("youtube", "tiktok") else "post"
    price = estimate_influencer_price(
        platform=platform,
        followers=followers,
        er=er_result.engagement_rate,
        niche=niche,
        content_type=content_type,  # type: ignore[arg-type]
    )
    best_times = get_best_posting_times(platform)

    return InfluencerAnalysis(
        username=username,
        platform=platform,
        followers=followers,
        engagement_rate=er_result.engagement_rate,
        engagement_tier=er_result.tier,
        estimated_price=asdict(price),
        best_times=asdict(best_times),
        niche=niche,
    )


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

async def _persist_insights(
    social_account_id: str,
    project_id: str,
    platform: str,
    stats: PlatformStats,
    er: float,
) -> None:
    async with db_session() as session:
        await session.execute(
            text("""
                INSERT INTO influencer_analyses
                    (project_id, platform, username, followers_count,
                     engagement_rate, raw_stats, created_at)
                VALUES
                    (:project_id, :platform, :username, :followers,
                     :er, CAST(:raw_stats AS JSONB), NOW())
                ON CONFLICT DO NOTHING
            """),
            {
                "project_id": project_id,
                "platform": platform,
                "username": social_account_id,
                "followers": stats.followers,
                "er": er,
                "raw_stats": json.dumps(asdict(stats)),
            },
        )
        await session.commit()
    logger.info("Persisted audience insights for account {}", social_account_id)
