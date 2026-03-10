# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/platform_analyzers.py
# DESCRIPTION  : Per-platform audience statistics analyzers
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx
from cryptography.fernet import Fernet, MultiFernet

from configs.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decrypt_token(encrypted_token: str) -> str:
    """Decrypt a Fernet-encrypted OAuth token."""
    keys = [Fernet(settings.fernet_key.encode())]
    if settings.fernet_key_previous:
        keys.append(Fernet(settings.fernet_key_previous.encode()))
    f = MultiFernet(keys)
    return f.decrypt(encrypted_token.encode()).decode()


@dataclass
class PlatformStats:
    platform: str
    followers: int = 0
    following: int = 0
    posts_count: int = 0
    avg_likes: float = 0.0
    avg_comments: float = 0.0
    avg_views: float = 0.0
    avg_shares: float = 0.0
    engagement_rate: float = 0.0
    top_content_types: list[str] = field(default_factory=list)
    audience_age_distribution: dict[str, float] = field(default_factory=dict)
    audience_gender_split: dict[str, float] = field(default_factory=dict)
    audience_top_countries: list[str] = field(default_factory=list)
    confidence: str = "high"
    raw_data: dict[str, Any] = field(default_factory=dict)


class InstagramAnalyzer:
    """Analyze an Instagram account via Meta Graph API."""

    API_BASE = "https://graph.instagram.com/v19.0"

    async def analyze(self, social_account: dict) -> PlatformStats:
        try:
            token = _decrypt_token(social_account["access_token_enc"])
            ig_user_id = social_account.get("platform_user_id", "me")

            async with httpx.AsyncClient(timeout=20.0) as client:
                # Basic profile stats
                r = await client.get(
                    f"{self.API_BASE}/{ig_user_id}",
                    params={
                        "fields": "followers_count,follows_count,media_count",
                        "access_token": token,
                    },
                )
                r.raise_for_status()
                profile = r.json()

                # Recent media insights (last 12 posts)
                rm = await client.get(
                    f"{self.API_BASE}/{ig_user_id}/media",
                    params={
                        "fields": "like_count,comments_count,media_type,reach",
                        "limit": 12,
                        "access_token": token,
                    },
                )
                rm.raise_for_status()
                media = rm.json().get("data", [])

            followers = profile.get("followers_count", 0) or 1
            likes = [m.get("like_count", 0) for m in media]
            comments = [m.get("comments_count", 0) for m in media]
            avg_likes = sum(likes) / max(len(likes), 1)
            avg_comments = sum(comments) / max(len(comments), 1)
            er = (avg_likes + avg_comments) / followers * 100

            return PlatformStats(
                platform="instagram",
                followers=followers,
                following=profile.get("follows_count", 0),
                posts_count=profile.get("media_count", 0),
                avg_likes=round(avg_likes, 2),
                avg_comments=round(avg_comments, 2),
                engagement_rate=round(er, 2),
                raw_data=profile,
            )
        except Exception as exc:
            logger.warning("InstagramAnalyzer failed: %s", exc)
            return PlatformStats(platform="instagram", confidence="low")


class TikTokAnalyzer:
    """Analyze a TikTok account via TikTok Content Posting API."""

    API_BASE = "https://open.tiktokapis.com/v2"

    async def analyze(self, social_account: dict) -> PlatformStats:
        try:
            token = _decrypt_token(social_account["access_token_enc"])

            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self.API_BASE}/user/info/",
                    params={"fields": "follower_count,following_count,video_count,likes_count"},
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                data = r.json().get("data", {}).get("user", {})

            followers = data.get("follower_count", 0) or 1

            return PlatformStats(
                platform="tiktok",
                followers=followers,
                following=data.get("following_count", 0),
                posts_count=data.get("video_count", 0),
                confidence="medium",
                raw_data=data,
            )
        except Exception as exc:
            logger.warning("TikTokAnalyzer failed: %s", exc)
            return PlatformStats(platform="tiktok", confidence="low")


class YouTubeAnalyzer:
    """Analyze a YouTube channel via YouTube Data API v3."""

    API_BASE = "https://www.googleapis.com/youtube/v3"

    async def analyze(self, social_account: dict) -> PlatformStats:
        try:
            token = _decrypt_token(social_account["access_token_enc"])

            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self.API_BASE}/channels",
                    params={
                        "part": "statistics,snippet",
                        "mine": "true",
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                items = r.json().get("items", [])

            if not items:
                return PlatformStats(platform="youtube", confidence="low")

            stats = items[0].get("statistics", {})
            followers = int(stats.get("subscriberCount", 0)) or 1
            views = int(stats.get("viewCount", 0))
            videos = int(stats.get("videoCount", 0))

            return PlatformStats(
                platform="youtube",
                followers=followers,
                posts_count=videos,
                avg_views=round(views / max(videos, 1), 2),
                confidence="high",
                raw_data=stats,
            )
        except Exception as exc:
            logger.warning("YouTubeAnalyzer failed: %s", exc)
            return PlatformStats(platform="youtube", confidence="low")


class XAnalyzer:
    """Analyze an X (Twitter) account via X API v2."""

    API_BASE = "https://api.twitter.com/2"

    async def analyze(self, social_account: dict) -> PlatformStats:
        try:
            token = _decrypt_token(social_account["access_token_enc"])

            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self.API_BASE}/users/me",
                    params={"user.fields": "public_metrics"},
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                metrics = r.json().get("data", {}).get("public_metrics", {})

            followers = metrics.get("followers_count", 0) or 1

            return PlatformStats(
                platform="x",
                followers=followers,
                following=metrics.get("following_count", 0),
                posts_count=metrics.get("tweet_count", 0),
                confidence="high",
                raw_data=metrics,
            )
        except Exception as exc:
            logger.warning("XAnalyzer failed: %s", exc)
            return PlatformStats(platform="x", confidence="low")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_ANALYZERS: dict[str, Any] = {
    "instagram": InstagramAnalyzer,
    "tiktok":    TikTokAnalyzer,
    "youtube":   YouTubeAnalyzer,
    "x":         XAnalyzer,
}


async def get_platform_stats(social_account: dict) -> PlatformStats:
    """Dispatch to the correct platform analyzer."""
    platform = social_account.get("platform", "")
    analyzer_cls = _ANALYZERS.get(platform)
    if not analyzer_cls:
        return PlatformStats(platform=platform, confidence="low")
    return await analyzer_cls().analyze(social_account)
