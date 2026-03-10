# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/tiktok_publisher.py
# DESCRIPTION  : TikTok Content Posting API publisher
# SECURITY     : Triple-check before any publish (status, campaign, token)
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx
from loguru import logger

from backend.exceptions import BrandpilotError
from microservices.bs_social_publisher.oauth_manager import oauth_manager
from microservices.bs_social_publisher.instagram_publisher import (
    BlockedPublicationError,
    MissingTokenError,
    PublishResult,
)

CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB


async def publish_tiktok_video(
    post: dict,
    social_account_id: str,
    video_bytes: bytes,
) -> PublishResult:
    """
    Publish a video to TikTok via Content Posting API.

    Security checks (in order):
        1. post.status == "approved"
        2. post.campaign.status in ("approved", "active")
        3. access_token non-empty

    Upload strategy:
        - Single chunk if video ≤ 10 MB
        - Multi-chunk if video > 10 MB

    Args:
        post:              Post dict with keys: id, status, caption, campaign.
        social_account_id: social_accounts row UUID.
        video_bytes:       Raw video file bytes.

    Returns:
        PublishResult.
    """
    # --- Security check 1 ---
    if post.get("status") != "approved":
        raise BlockedPublicationError(
            f"Post {post.get('id')} is not approved (status={post.get('status')})"
        )

    # --- Security check 2 ---
    campaign = post.get("campaign", {})
    if campaign.get("status") not in ("approved", "active"):
        raise BlockedPublicationError(
            f"Campaign {campaign.get('id')} not approved/active "
            f"(status={campaign.get('status')})"
        )

    # --- Security check 3 ---
    access_token = await oauth_manager.get_valid_token(social_account_id)
    if not access_token:
        raise MissingTokenError(f"No access token for social_account {social_account_id}")

    post_id = str(post.get("id", "unknown"))
    caption = post.get("caption", "")[:2200]
    video_size = len(video_bytes)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1: Init upload
            chunk_count = max(1, -(-video_size // CHUNK_SIZE))  # ceil division
            init_r = await client.post(
                "https://open.tiktokapis.com/v2/post/publish/video/init/",
                json={
                    "post_info": {"title": caption, "privacy_level": "PUBLIC_TO_EVERYONE"},
                    "source_info": {
                        "source":          "FILE_UPLOAD",
                        "video_size":      video_size,
                        "chunk_size":      CHUNK_SIZE,
                        "total_chunk_count": chunk_count,
                    },
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )
            init_r.raise_for_status()
            init_data = init_r.json().get("data", {})
            upload_url = init_data["upload_url"]
            publish_id = init_data["publish_id"]

            # Step 2: Upload chunks
            for i in range(chunk_count):
                chunk = video_bytes[i * CHUNK_SIZE: (i + 1) * CHUNK_SIZE]
                start = i * CHUNK_SIZE
                end = start + len(chunk) - 1
                chunk_r = await client.put(
                    upload_url,
                    content=chunk,
                    headers={
                        "Content-Range":  f"bytes {start}-{end}/{video_size}",
                        "Content-Length": str(len(chunk)),
                        "Content-Type":   "video/mp4",
                    },
                )
                chunk_r.raise_for_status()
                logger.info("TikTok chunk {}/{} uploaded for post {}", i + 1, chunk_count, post_id)

            # Step 3: Poll publish status (up to 120s)
            for _ in range(24):
                await asyncio.sleep(5)
                status_r = await client.post(
                    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
                    json={"publish_id": publish_id},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                status_r.raise_for_status()
                status_data = status_r.json().get("data", {})
                pub_status = status_data.get("status")
                if pub_status == "PUBLISH_COMPLETE":
                    platform_post_id = status_data.get("publicaly_available_post_id", [""])[0]
                    logger.info("Post {} published to TikTok: {}", post_id, platform_post_id)
                    return PublishResult(
                        platform="tiktok",
                        post_id=post_id,
                        success=True,
                        platform_post_id=platform_post_id,
                    )
                if pub_status in ("FAILED", "CANCELLED"):
                    raise RuntimeError(f"TikTok publish status: {pub_status}")

        raise RuntimeError("TikTok publish timed out after 120s")

    except (BlockedPublicationError, MissingTokenError):
        raise
    except Exception as exc:
        logger.error("TikTok publish failed for post {}: type={}", post_id, type(exc).__name__)
        return PublishResult(
            platform="tiktok",
            post_id=post_id,
            success=False,
            error=type(exc).__name__,
        )
