# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/youtube_publisher.py
# DESCRIPTION  : YouTube Data API v3 resumable upload publisher
# SECURITY     : Triple-check before any publish (status, campaign, token)
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import httpx
from loguru import logger

from microservices.bs_social_publisher.oauth_manager import oauth_manager
from microservices.bs_social_publisher.instagram_publisher import (
    BlockedPublicationError,
    MissingTokenError,
    PublishResult,
)

YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB


async def publish_youtube_video(
    post: dict,
    social_account_id: str,
    video_bytes: bytes,
    title: str,
    description: str,
    tags: list[str] | None = None,
    privacy_status: str = "public",
) -> PublishResult:
    """
    Publish a video to YouTube via resumable upload.

    Security checks (in order):
        1. post.status == "approved"
        2. post.campaign.status in ("approved", "active")
        3. access_token non-empty

    Args:
        post:              Post dict with id, status, campaign.
        social_account_id: social_accounts row UUID.
        video_bytes:       Raw video bytes (any YouTube-compatible format).
        title:             Video title (max 100 chars).
        description:       Video description (max 5000 chars).
        tags:              List of tags (optional).
        privacy_status:    "public", "unlisted", or "private".

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
    video_size = len(video_bytes)

    metadata = {
        "snippet": {
            "title":       title[:100],
            "description": description[:5000],
            "tags":        tags or [],
        },
        "status": {"privacyStatus": privacy_status},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1: Initiate resumable upload session
            init_r = await client.post(
                YOUTUBE_UPLOAD_URL,
                params={"uploadType": "resumable", "part": "snippet,status"},
                json=metadata,
                headers={
                    "Authorization":          f"Bearer {access_token}",
                    "Content-Type":           "application/json; charset=UTF-8",
                    "X-Upload-Content-Type":  "video/mp4",
                    "X-Upload-Content-Length": str(video_size),
                },
            )
            init_r.raise_for_status()
            upload_url = init_r.headers["Location"]

            # Step 2: Upload video in chunks
            offset = 0
            video_id = None
            while offset < video_size:
                chunk = video_bytes[offset: offset + CHUNK_SIZE]
                end = offset + len(chunk) - 1
                chunk_r = await client.put(
                    upload_url,
                    content=chunk,
                    headers={
                        "Content-Range": f"bytes {offset}-{end}/{video_size}",
                        "Content-Length": str(len(chunk)),
                        "Content-Type":  "video/mp4",
                    },
                )
                if chunk_r.status_code in (200, 201):
                    video_id = chunk_r.json().get("id")
                    break
                elif chunk_r.status_code == 308:
                    # Incomplete — update offset from Range header
                    range_header = chunk_r.headers.get("Range", f"bytes=0-{end}")
                    offset = int(range_header.split("-")[1]) + 1
                else:
                    chunk_r.raise_for_status()

        if not video_id:
            raise RuntimeError("YouTube upload completed but no video ID returned")

        logger.info("Post {} published to YouTube: {}", post_id, video_id)
        return PublishResult(
            platform="youtube",
            post_id=post_id,
            success=True,
            platform_post_id=video_id,
        )

    except (BlockedPublicationError, MissingTokenError):
        raise
    except Exception as exc:
        logger.error("YouTube publish failed for post {}: type={}", post_id, type(exc).__name__)
        return PublishResult(
            platform="youtube",
            post_id=post_id,
            success=False,
            error=type(exc).__name__,
        )
