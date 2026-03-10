# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/service.py
# DESCRIPTION  : Social publishing orchestration service
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Literal

from loguru import logger
from sqlalchemy import text

from database.connection import db_session
from microservices.bs_social_publisher.analytics_collector import collect_post_metrics
from microservices.bs_social_publisher.instagram_publisher import (
    BlockedPublicationError,
    MissingTokenError,
    PublishResult,
    publish_instagram_post,
)
from microservices.bs_social_publisher.tiktok_publisher import publish_tiktok_video
from microservices.bs_social_publisher.youtube_publisher import publish_youtube_video
from microservices.bs_social_publisher.twitter_publisher import publish_x_post
from microservices.bs_social_publisher.linkedin_publisher import publish_linkedin_post
from microservices.bs_social_publisher.oauth_manager import oauth_manager


FailureReason = Literal[
    "oauth_expired", "rate_limited", "content_rejected", "platform_down", "unknown"
]


@dataclass
class PublishSummary:
    post_id: str
    platform: str
    success: bool
    platform_post_id: str | None = None
    failure_reason: FailureReason | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Publish dispatcher
# ---------------------------------------------------------------------------

async def publish_post(
    post_id: str,
    social_account_id: str,
    video_bytes: bytes | None = None,
    image_bytes: bytes | None = None,
) -> PublishSummary:
    """
    Dispatch a post to the correct platform publisher.

    Args:
        post_id:           Internal post UUID (Content table).
        social_account_id: social_accounts row UUID.
        video_bytes:       Optional video bytes (TikTok / YouTube).
        image_bytes:       Optional image bytes (Instagram / LinkedIn / X).

    Returns:
        PublishSummary.
    """
    async with db_session() as session:
        post_row = await session.execute(
            text("""
                SELECT c.*, camp.status AS campaign_status, camp.id AS campaign_id
                FROM content c
                JOIN campaigns camp ON c.campaign_id = camp.id
                WHERE c.id = :id
            """),
            {"id": post_id},
        )
        post = dict(post_row.mappings().first() or {})

        account_row = await session.execute(
            text("SELECT platform FROM social_accounts WHERE id = :id"),
            {"id": social_account_id},
        )
        account = dict(account_row.mappings().first() or {})

    if not post:
        raise ValueError(f"Post {post_id} not found")
    if not account:
        raise ValueError(f"Social account {social_account_id} not found")

    platform = account["platform"]
    post["campaign"] = {
        "id": post.get("campaign_id"),
        "status": post.get("campaign_status"),
    }

    result: PublishResult
    try:
        if platform == "instagram":
            ig_user_id = post.get("ig_user_id", "")
            result = await publish_instagram_post(post, social_account_id, ig_user_id)

        elif platform == "tiktok":
            result = await publish_tiktok_video(post, social_account_id, video_bytes or b"")

        elif platform == "youtube":
            result = await publish_youtube_video(
                post=post,
                social_account_id=social_account_id,
                video_bytes=video_bytes or b"",
                title=post.get("title", ""),
                description=post.get("caption", ""),
            )

        elif platform == "x":
            result = await publish_x_post(post, social_account_id, media_bytes=image_bytes)

        elif platform == "linkedin":
            result = await publish_linkedin_post(post, social_account_id, image_bytes=image_bytes)

        else:
            raise ValueError(f"Unsupported platform: {platform}")

    except BlockedPublicationError as exc:
        return PublishSummary(
            post_id=post_id, platform=platform,
            success=False, failure_reason="content_rejected",
            error=str(exc),
        )
    except MissingTokenError as exc:
        return PublishSummary(
            post_id=post_id, platform=platform,
            success=False, failure_reason="oauth_expired",
            error=type(exc).__name__,
        )
    except Exception as exc:
        reason = _classify_failure(exc)
        return PublishSummary(
            post_id=post_id, platform=platform,
            success=False, failure_reason=reason,
            error=type(exc).__name__,
        )

    if result.success:
        await _mark_published(post_id, result.platform_post_id)
    else:
        await _handle_publish_failure(post_id, result.error or "unknown")

    return PublishSummary(
        post_id=post_id,
        platform=platform,
        success=result.success,
        platform_post_id=result.platform_post_id,
        failure_reason=_classify_failure_str(result.error) if not result.success else None,
        error=result.error if not result.success else None,
    )


# ---------------------------------------------------------------------------
# Failure handling
# ---------------------------------------------------------------------------

def _classify_failure(exc: Exception) -> FailureReason:
    name = type(exc).__name__.lower()
    if "auth" in name or "token" in name or "401" in str(exc):
        return "oauth_expired"
    if "rate" in name or "429" in str(exc):
        return "rate_limited"
    if "content" in name or "policy" in name:
        return "content_rejected"
    if "timeout" in name or "connect" in name or "503" in str(exc):
        return "platform_down"
    return "unknown"


def _classify_failure_str(error_name: str | None) -> FailureReason:
    if not error_name:
        return "unknown"
    low = error_name.lower()
    if "auth" in low or "token" in low:
        return "oauth_expired"
    if "rate" in low:
        return "rate_limited"
    if "content" in low or "policy" in low:
        return "content_rejected"
    return "unknown"


async def handle_publish_failure(post_id: str, reason: FailureReason) -> None:
    """Update content row with failure status."""
    await _handle_publish_failure(post_id, reason)


async def _handle_publish_failure(post_id: str, reason: str) -> None:
    async with db_session() as session:
        await session.execute(
            text("""
                UPDATE content
                SET status = 'failed',
                    metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{publish_error}',
                        :reason::jsonb
                    ),
                    updated_at = NOW()
                WHERE id = :post_id
            """),
            {"post_id": post_id, "reason": json.dumps(reason)},
        )
        await session.commit()
    logger.warning("Post {} publish failed: {}", post_id, reason)


async def _mark_published(post_id: str, platform_post_id: str | None) -> None:
    async with db_session() as session:
        await session.execute(
            text("""
                UPDATE content
                SET status = 'published',
                    metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{platform_post_id}',
                        :ppid::jsonb
                    ),
                    updated_at = NOW()
                WHERE id = :post_id
            """),
            {"post_id": post_id, "ppid": json.dumps(platform_post_id)},
        )
        await session.commit()
    logger.info("Post {} marked as published (platform_id={})", post_id, platform_post_id)
