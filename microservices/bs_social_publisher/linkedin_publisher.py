# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/linkedin_publisher.py
# DESCRIPTION  : LinkedIn UGC Posts API publisher
# SECURITY     : Triple-check before any publish (status, campaign, token)
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import base64

import httpx
from loguru import logger

from microservices.bs_social_publisher.oauth_manager import oauth_manager
from microservices.bs_social_publisher.instagram_publisher import (
    BlockedPublicationError,
    MissingTokenError,
    PublishResult,
)

LI_UGC_URL = "https://api.linkedin.com/v2/ugcPosts"
LI_ASSETS_URL = "https://api.linkedin.com/v2/assets?action=registerUpload"


async def _get_linkedin_urn(access_token: str) -> str:
    """Fetch the authenticated member's URN."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            "https://api.linkedin.com/v2/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return f"urn:li:person:{r.json()['id']}"


async def _upload_image(access_token: str, image_bytes: bytes, person_urn: str) -> str:
    """Register + upload image to LinkedIn and return asset URN."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Register upload
        reg_r = await client.post(
            LI_ASSETS_URL,
            json={
                "registerUploadRequest": {
                    "recipes":           ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner":             person_urn,
                    "serviceRelationships": [{
                        "relationshipType": "OWNER",
                        "identifier":       "urn:li:userGeneratedContent",
                    }],
                }
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
        )
        reg_r.raise_for_status()
        reg_data = reg_r.json()
        asset_urn = reg_data["value"]["asset"]
        upload_url = reg_data["value"]["uploadMechanism"][
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ]["uploadUrl"]

        # Step 2: Upload binary
        up_r = await client.put(
            upload_url,
            content=image_bytes,
            headers={
                "Authorization":  f"Bearer {access_token}",
                "Content-Type":   "image/jpeg",
            },
        )
        up_r.raise_for_status()

    return asset_urn


async def publish_linkedin_post(
    post: dict,
    social_account_id: str,
    image_bytes: bytes | None = None,
) -> PublishResult:
    """
    Publish a UGC post to LinkedIn.

    Security checks (in order):
        1. post.status == "approved"
        2. post.campaign.status in ("approved", "active")
        3. access_token non-empty

    Args:
        post:              Post dict with id, status, content/caption, campaign.
        social_account_id: social_accounts row UUID.
        image_bytes:       Optional image bytes to attach.

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
    content = post.get("content", post.get("caption", ""))

    try:
        person_urn = await _get_linkedin_urn(access_token)

        share_content: dict = {
            "shareCommentary":    {"text": content[:3000]},
            "shareMediaCategory": "NONE",
        }

        if image_bytes:
            asset_urn = await _upload_image(access_token, image_bytes, person_urn)
            share_content["shareMediaCategory"] = "IMAGE"
            share_content["media"] = [{
                "status": "READY",
                "media":  asset_urn,
            }]

        ugc_body = {
            "author":          person_urn,
            "lifecycleState":  "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": share_content,
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                LI_UGC_URL,
                json=ugc_body,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type":  "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )
            r.raise_for_status()
            platform_post_id = r.headers.get("X-RestLi-Id", "")

        logger.info("Post {} published to LinkedIn: {}", post_id, platform_post_id)
        return PublishResult(
            platform="linkedin",
            post_id=post_id,
            success=True,
            platform_post_id=platform_post_id,
        )

    except (BlockedPublicationError, MissingTokenError):
        raise
    except Exception as exc:
        logger.error("LinkedIn publish failed for post {}: type={}", post_id, type(exc).__name__)
        return PublishResult(
            platform="linkedin",
            post_id=post_id,
            success=False,
            error=type(exc).__name__,
        )
