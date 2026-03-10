# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/instagram_publisher.py
# DESCRIPTION  : Instagram Meta Graph API publisher
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


class BlockedPublicationError(BrandpilotError):
    """Raised when a post or campaign is not in an approved state."""


class MissingTokenError(BrandpilotError):
    """Raised when no valid OAuth token is available."""


@dataclass
class PublishResult:
    platform: str
    post_id: str | None
    success: bool
    platform_post_id: str | None = None
    error: str | None = None


async def publish_instagram_post(
    post: dict,
    social_account_id: str,
    ig_user_id: str,
) -> PublishResult:
    """
    Publish a post to Instagram via Meta Graph Content Publishing API.

    Security checks (in order):
        1. post.status == "approved"
        2. post.campaign.status in ("approved", "active")
        3. access_token non-empty

    Args:
        post:               Post dict with keys: id, status, caption, image_url, campaign.
        social_account_id:  social_accounts row UUID.
        ig_user_id:         Instagram user/page ID.

    Returns:
        PublishResult.
    """
    # --- Security check 1: post status ---
    if post.get("status") != "approved":
        raise BlockedPublicationError(
            f"Post {post.get('id')} is not approved (status={post.get('status')})"
        )

    # --- Security check 2: campaign status ---
    campaign = post.get("campaign", {})
    if campaign.get("status") not in ("approved", "active"):
        raise BlockedPublicationError(
            f"Campaign {campaign.get('id')} is not approved/active "
            f"(status={campaign.get('status')})"
        )

    # --- Security check 3: token ---
    access_token = await oauth_manager.get_valid_token(social_account_id)
    if not access_token:
        raise MissingTokenError(f"No access token for social_account {social_account_id}")

    post_id = str(post.get("id", "unknown"))
    caption = post.get("caption", "")
    image_url = post.get("image_url", "")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Create media container
            container_r = await client.post(
                f"https://graph.facebook.com/v19.0/{ig_user_id}/media",
                data={
                    "image_url":    image_url,
                    "caption":      caption,
                    "access_token": access_token,
                },
            )
            container_r.raise_for_status()
            container_id = container_r.json()["id"]
            logger.info("Instagram container created {} for post {}", container_id, post_id)

            # Step 2: Poll until container is ready (up to 60s)
            for _ in range(12):
                status_r = await client.get(
                    f"https://graph.facebook.com/v19.0/{container_id}",
                    params={"fields": "status_code", "access_token": access_token},
                )
                status_r.raise_for_status()
                status_code = status_r.json().get("status_code")
                if status_code == "FINISHED":
                    break
                if status_code == "ERROR":
                    raise RuntimeError("Instagram container processing failed")
                await asyncio.sleep(5)

            # Step 3: Publish container
            publish_r = await client.post(
                f"https://graph.facebook.com/v19.0/{ig_user_id}/media_publish",
                data={
                    "creation_id":  container_id,
                    "access_token": access_token,
                },
            )
            publish_r.raise_for_status()
            platform_post_id = publish_r.json()["id"]

        logger.info("Post {} published to Instagram: {}", post_id, platform_post_id)
        return PublishResult(
            platform="instagram",
            post_id=post_id,
            success=True,
            platform_post_id=platform_post_id,
        )

    except (BlockedPublicationError, MissingTokenError):
        raise
    except Exception as exc:
        logger.error("Instagram publish failed for post {}: type={}", post_id, type(exc).__name__)
        return PublishResult(
            platform="instagram",
            post_id=post_id,
            success=False,
            error=type(exc).__name__,
        )
