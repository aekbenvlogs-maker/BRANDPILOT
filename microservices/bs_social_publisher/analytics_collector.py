# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/analytics_collector.py
# DESCRIPTION  : Post-publication metrics collector
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from dataclasses import dataclass, field

import httpx
from loguru import logger

from microservices.bs_social_publisher.oauth_manager import oauth_manager


@dataclass
class SocialMetrics:
    post_id: str
    platform: str
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    reach: int = 0
    impressions: int = 0
    engagement_rate: float = 0.0
    raw: dict = field(default_factory=dict)


async def collect_post_metrics(
    post_id: str,
    platform: str,
    access_token: str,
    platform_post_id: str,
) -> SocialMetrics:
    """
    Collect engagement metrics for a published post.

    Args:
        post_id:          Internal BRANDPILOT post UUID.
        platform:         Social platform key.
        access_token:     Plaintext OAuth token.
        platform_post_id: Platform-native post/video/tweet ID.

    Returns:
        SocialMetrics dataclass.
    """
    handlers = {
        "instagram": _instagram_metrics,
        "tiktok":    _tiktok_metrics,
        "youtube":   _youtube_metrics,
        "x":         _x_metrics,
        "linkedin":  _linkedin_metrics,
    }
    handler = handlers.get(platform)
    if not handler:
        logger.warning("No metrics handler for platform {}", platform)
        return SocialMetrics(post_id=post_id, platform=platform)

    try:
        return await handler(post_id, access_token, platform_post_id)
    except Exception as exc:
        logger.error("Metrics collection failed for post {} on {}: type={}", post_id, platform, type(exc).__name__)
        return SocialMetrics(post_id=post_id, platform=platform)


async def _instagram_metrics(post_id: str, token: str, ig_media_id: str) -> SocialMetrics:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"https://graph.facebook.com/v19.0/{ig_media_id}/insights",
            params={
                "metric":       "reach,impressions,saved,video_views",
                "access_token": token,
            },
        )
        r.raise_for_status()
        data = {item["name"]: item["values"][0]["value"] for item in r.json().get("data", [])}

        like_r = await client.get(
            f"https://graph.facebook.com/v19.0/{ig_media_id}",
            params={"fields": "like_count,comments_count", "access_token": token},
        )
        like_r.raise_for_status()
        like_data = like_r.json()

    likes = like_data.get("like_count", 0)
    comments = like_data.get("comments_count", 0)
    reach = data.get("reach", 0) or 1
    er = (likes + comments) / reach * 100

    return SocialMetrics(
        post_id=post_id, platform="instagram",
        likes=likes, comments=comments,
        saves=data.get("saved", 0),
        reach=data.get("reach", 0),
        impressions=data.get("impressions", 0),
        views=data.get("video_views", 0),
        engagement_rate=round(er, 2),
        raw=data,
    )


async def _tiktok_metrics(post_id: str, token: str, video_id: str) -> SocialMetrics:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            "https://open.tiktokapis.com/v2/video/query/",
            json={
                "filters": {"video_ids": [video_id]},
                "fields":  ["id", "like_count", "comment_count", "share_count", "view_count"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        videos = r.json().get("data", {}).get("videos", [{}])
        v = videos[0] if videos else {}

    views = v.get("view_count", 0) or 1
    likes = v.get("like_count", 0)
    comments = v.get("comment_count", 0)
    shares = v.get("share_count", 0)
    er = (likes + comments + shares) / views * 100

    return SocialMetrics(
        post_id=post_id, platform="tiktok",
        views=views, likes=likes, comments=comments, shares=shares,
        engagement_rate=round(er, 2),
        raw=v,
    )


async def _youtube_metrics(post_id: str, token: str, video_id: str) -> SocialMetrics:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "part": "statistics",
                "id":   video_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        items = r.json().get("items", [{}])
        stats = items[0].get("statistics", {}) if items else {}

    views = int(stats.get("viewCount", 0)) or 1
    likes = int(stats.get("likeCount", 0))
    comments = int(stats.get("commentCount", 0))
    er = (likes + comments) / views * 100

    return SocialMetrics(
        post_id=post_id, platform="youtube",
        views=views, likes=likes, comments=comments,
        engagement_rate=round(er, 2),
        raw=stats,
    )


async def _x_metrics(post_id: str, token: str, tweet_id: str) -> SocialMetrics:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"https://api.twitter.com/2/tweets/{tweet_id}",
            params={"tweet.fields": "public_metrics"},
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        metrics = r.json().get("data", {}).get("public_metrics", {})

    impressions = metrics.get("impression_count", 0) or 1
    likes = metrics.get("like_count", 0)
    retweets = metrics.get("retweet_count", 0)
    replies = metrics.get("reply_count", 0)
    er = (likes + retweets + replies) / impressions * 100

    return SocialMetrics(
        post_id=post_id, platform="x",
        likes=likes, shares=retweets, comments=replies,
        impressions=impressions,
        engagement_rate=round(er, 2),
        raw=metrics,
    )


async def _linkedin_metrics(post_id: str, token: str, ugc_post_id: str) -> SocialMetrics:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"https://api.linkedin.com/v2/socialActions/{ugc_post_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )
        r.raise_for_status()
        data = r.json()

    likes = data.get("likesSummary", {}).get("totalLikes", 0)
    comments = data.get("commentsSummary", {}).get("totalFirstLevelComments", 0)

    return SocialMetrics(
        post_id=post_id, platform="linkedin",
        likes=likes, comments=comments,
        raw=data,
    )
