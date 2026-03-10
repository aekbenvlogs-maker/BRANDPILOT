# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/twitter_publisher.py
# DESCRIPTION  : X (Twitter) API v2 publisher with thread support
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
from microservices.bs_content_formatter.text_formatter import split_into_thread

X_TWEETS_URL = "https://api.twitter.com/2/tweets"
X_MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"


async def _upload_media(client: httpx.AsyncClient, media_bytes: bytes, access_token: str) -> str:
    """Upload media via v1.1 endpoint and return media_id_string."""
    import base64
    encoded = base64.b64encode(media_bytes).decode()
    r = await client.post(
        X_MEDIA_UPLOAD_URL,
        data={"media_data": encoded},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    r.raise_for_status()
    return r.json()["media_id_string"]


async def publish_x_post(
    post: dict,
    social_account_id: str,
    media_bytes: bytes | None = None,
) -> PublishResult:
    """
    Publish a post (or thread) to X via API v2.

    Security checks (in order):
        1. post.status == "approved"
        2. post.campaign.status in ("approved", "active")
        3. access_token non-empty

    If the content exceeds 280 characters, it is automatically split into a
    numbered thread and each tweet is posted as a reply to the previous one.

    Args:
        post:              Post dict with id, status, content, campaign.
        social_account_id: social_accounts row UUID.
        media_bytes:       Optional image/video bytes to attach to the first tweet.

    Returns:
        PublishResult with the first tweet's ID as platform_post_id.
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

    tweets = split_into_thread(content) if len(content) > 280 else [content]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            }

            # Upload media for first tweet only
            media_id: str | None = None
            if media_bytes:
                media_id = await _upload_media(client, media_bytes, access_token)

            reply_to_id: str | None = None
            first_tweet_id: str | None = None

            for i, tweet_text in enumerate(tweets):
                body: dict = {"text": tweet_text}
                if i == 0 and media_id:
                    body["media"] = {"media_ids": [media_id]}
                if reply_to_id:
                    body["reply"] = {"in_reply_to_tweet_id": reply_to_id}

                r = await client.post(X_TWEETS_URL, json=body, headers=headers)
                r.raise_for_status()
                tweet_id = r.json()["data"]["id"]

                if first_tweet_id is None:
                    first_tweet_id = tweet_id
                reply_to_id = tweet_id
                logger.info("Tweet {}/{} posted for post {}: {}", i + 1, len(tweets), post_id, tweet_id)

        return PublishResult(
            platform="x",
            post_id=post_id,
            success=True,
            platform_post_id=first_tweet_id,
        )

    except (BlockedPublicationError, MissingTokenError):
        raise
    except Exception as exc:
        logger.error("X publish failed for post {}: type={}", post_id, type(exc).__name__)
        return PublishResult(
            platform="x",
            post_id=post_id,
            success=False,
            error=type(exc).__name__,
        )
