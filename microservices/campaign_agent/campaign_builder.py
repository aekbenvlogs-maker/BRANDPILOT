# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/campaign_agent/campaign_builder.py
# DESCRIPTION  : CampaignBuilder — assembles the final SocialPost list
#                from GPT-4 content, media assets, and scheduling data
#                produced by the parallel Celery chord.
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================
"""
CampaignBuilder: Step 6-8 of the Campaign Agent pipeline.

Called by the Celery chord callback ``build_campaign_plan`` (worker.py)
after the parallel brand/audience/influencer analysis tasks complete.

Responsibilities:
  1. Accept chord results (brand analysis, audience data, influencer list).
  2. Generate post schedule dates from CampaignIntent frequency/duration.
  3. Construct a SocialPost for each scheduled date.
  4. Apply platform-specific content rules (character limits, hashtag caps).
  5. Return list[SocialPost] ready for persistence in WorkflowJob.result.

Design principles:
  - Pure orchestration: no direct DB writes (caller handles persistence).
  - Deterministic scheduling: given the same intent, dates are reproducible
    if called with the same ``reference_dt``.
  - Extendable: add platform rules by extending ``_PLATFORM_RULES``.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from loguru import logger

from microservices.campaign_agent.agent import BrandContext, SocialPost
from microservices.campaign_agent.intent_parser import CampaignIntent

# ---------------------------------------------------------------------------
# Platform content rules
# ---------------------------------------------------------------------------

#: Platform-specific constraints applied during post assembly.
_PLATFORM_RULES: Final[dict[str, dict[str, Any]]] = {
    "instagram": {
        "max_caption_chars": 2200,
        "max_hashtags": 30,
        "best_post_hours": [8, 12, 18],          # UTC hours
    },
    "tiktok": {
        "max_caption_chars": 2200,
        "max_hashtags": 20,
        "best_post_hours": [7, 15, 21],
    },
    "youtube": {
        "max_caption_chars": 5000,
        "max_hashtags": 15,
        "best_post_hours": [14, 17],
    },
    "x": {
        "max_caption_chars": 280,
        "max_hashtags": 5,
        "best_post_hours": [9, 13, 17],
    },
    "linkedin": {
        "max_caption_chars": 3000,
        "max_hashtags": 10,
        "best_post_hours": [8, 12, 17],
    },
    "facebook": {
        "max_caption_chars": 63206,
        "max_hashtags": 10,
        "best_post_hours": [9, 13, 19],
    },
}

_DEFAULT_PLATFORM_RULES: Final[dict[str, Any]] = {
    "max_caption_chars": 2200,
    "max_hashtags": 20,
    "best_post_hours": [9, 15],
}

#: Default campaign duration in days when not specified by the intent.
_DEFAULT_DURATION_DAYS: Final[int] = 14

#: Default number of posts per day when not specified.
_DEFAULT_POSTS_PER_DAY: Final[int] = 1

#: Platform-specific posting frequencies (posts per day).
_POSTS_PER_DAY_BY_PLATFORM: Final[dict[str, int]] = {
    "instagram": 1,
    "tiktok": 2,
    "youtube": 1,
    "x": 3,
    "linkedin": 1,
    "facebook": 1,
    "multi": 1,
}


# ---------------------------------------------------------------------------
# CampaignBuilder
# ---------------------------------------------------------------------------


class CampaignBuilder:
    """Assembles a list of SocialPost objects for a campaign.

    This class is stateless and can be used directly in Celery tasks.

    Usage::

        builder = CampaignBuilder()
        posts = builder.build_posts(
            campaign_id="...",
            intent=intent,
            context=context,
            chord_results=[brand_data, audience_data, influencer_data],
        )
    """

    def build_posts(
        self,
        campaign_id: str,
        intent: CampaignIntent,
        context: BrandContext,
        chord_results: list[dict[str, Any]],
        reference_dt: datetime | None = None,
    ) -> list[SocialPost]:
        """Assemble all SocialPost objects for the campaign.

        Args:
            campaign_id:   UUID of the owning campaign.
            intent:        Parsed CampaignIntent.
            context:       Brand context (name, tone, audience).
            chord_results: List of results from the parallel Celery header
                           tasks (brand analysis, audience, influencers).
            reference_dt:  Reference datetime for scheduling (default: now UTC).

        Returns:
            List of SocialPost instances with status='pending_validation'.
        """
        reference_dt = reference_dt or datetime.now(UTC)
        rules = _PLATFORM_RULES.get(
            intent.platform.lower(), _DEFAULT_PLATFORM_RULES
        )
        duration_days = int(intent.duration_days)
        posts_per_day = _POSTS_PER_DAY_BY_PLATFORM.get(
            intent.platform.lower(), _DEFAULT_POSTS_PER_DAY
        )
        schedule = _build_schedule(
            reference_dt=reference_dt,
            duration_days=duration_days,
            posts_per_day=posts_per_day,
            best_hours=rules["best_post_hours"],
        )

        brand_data = chord_results[0] if len(chord_results) > 0 else {}
        audience_data = chord_results[1] if len(chord_results) > 1 else {}
        influencer_data = chord_results[2] if len(chord_results) > 2 else {}

        posts: list[SocialPost] = []
        for i, scheduled_at in enumerate(schedule):
            caption = _generate_caption_stub(
                intent=intent,
                context=context,
                brand_data=brand_data,
                audience_data=audience_data,
                post_index=i,
                max_chars=rules["max_caption_chars"],
            )
            hashtags = _select_hashtags(
                intent=intent,
                audience_data=audience_data,
                max_count=rules["max_hashtags"],
            )
            post = SocialPost(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                platform=intent.platform,
                content_text=caption,
                media_urls=[],           # filled by bs_ai_image / bs_ai_video
                hashtags=hashtags,
                scheduled_at=scheduled_at.isoformat(),
                status="pending_validation",
            )
            posts.append(post)

        logger.info(
            "[CampaignBuilder] Posts assembled | campaign={} platform={} "
            "count={} duration={}d freq={}/day",
            campaign_id,
            intent.platform,
            len(posts),
            duration_days,
            posts_per_day,
        )
        _ = influencer_data  # reserved: influencer mention injection in v2
        return posts


# ---------------------------------------------------------------------------
# Scheduling helpers
# ---------------------------------------------------------------------------


def _build_schedule(
    reference_dt: datetime,
    duration_days: int,
    posts_per_day: int,
    best_hours: list[int],
) -> list[datetime]:
    """Produce a list of UTC datetimes for post publication.

    Slots are evenly distributed across ``best_hours`` in each day.
    Starts from ``reference_dt + 1 day`` to avoid immediate publishing.

    Args:
        reference_dt: Scheduling anchor (typically ``datetime.now(UTC)``).
        duration_days: Total campaign duration in days.
        posts_per_day: Number of posts per calendar day.
        best_hours:   List of preferred UTC posting hours.

    Returns:
        Sorted list of datetime objects (UTC, timezone-aware).
    """
    start = (reference_dt + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    slots: list[datetime] = []
    hours = (best_hours * math.ceil(posts_per_day / max(len(best_hours), 1)))[
        :posts_per_day
    ]
    for day_offset in range(duration_days):
        day = start + timedelta(days=day_offset)
        for hour in hours:
            slots.append(day.replace(hour=hour))
    return slots


# ---------------------------------------------------------------------------
# Content helpers (stubs — replaced by bs_ai_text in production)
# ---------------------------------------------------------------------------


def _generate_caption_stub(
    intent: CampaignIntent,
    context: BrandContext,
    brand_data: dict[str, Any],
    audience_data: dict[str, Any],
    post_index: int,
    max_chars: int,
) -> str:
    """Generate a placeholder caption stub for the post.

    In production this stub is replaced by the full GPT-4 generated caption
    produced by the ``bs_ai_text`` microservice (worker step 6).

    Args:
        intent:       Parsed intent.
        context:      Brand context.
        brand_data:   Result from brand analysis chord task.
        audience_data: Result from audience analysis chord task.
        post_index:   0-based post index (used for variation).
        max_chars:    Platform max caption length.

    Returns:
        Caption string truncated to max_chars.
    """
    variations = [
        f"🚀 {context.brand_name} — {intent.objective} | Post {post_index + 1}",
        f"✨ Discover {context.brand_name}: {intent.product_description or intent.objective}",
        f"💡 {intent.objective} with {context.brand_name} | #{intent.platform}",
    ]
    tone_emoji = {
        "energetic": "⚡",
        "luxury": "💎",
        "playful": "🎉",
        "inspirational": "🌟",
        "professional": "💼",
        "sustainable": "🌿",
        "innovative": "🔬",
    }.get(context.brand_tone, "✨")

    caption = f"{tone_emoji} {variations[post_index % len(variations)]}"

    # Append audience hint if available
    audience_hint = audience_data.get("primary_segment", "")
    if audience_hint:
        caption += f"\n\nFor {audience_hint}."

    return caption[:max_chars]


def _select_hashtags(
    intent: CampaignIntent,
    audience_data: dict[str, Any],
    max_count: int,
) -> list[str]:
    """Assemble a hashtag list from intent fields and audience data.

    Args:
        intent:        Parsed intent (platform and objective fields).
        audience_data: Result from audience analysis chord task.
        max_count:     Platform maximum hashtag count.

    Returns:
        List of hashtag strings (without ``#`` prefix).
    """
    base_tags = [
        intent.platform,
        intent.objective.replace(" ", "") if intent.objective else "brand",
        "brandpilot",
        "marketing",
    ]
    audience_tags: list[str] = audience_data.get("trending_hashtags", [])
    combined = base_tags + audience_tags
    # Deduplicate, lowercase, strip non-alphanumeric
    seen: set[str] = set()
    result: list[str] = []
    for tag in combined:
        clean = "".join(c for c in tag.lower() if c.isalnum())
        if clean and clean not in seen:
            seen.add(clean)
            result.append(clean)
        if len(result) >= max_count:
            break
    return result


# ---------------------------------------------------------------------------
# Intent field parsers
# ---------------------------------------------------------------------------


def _parse_duration(duration_str: str | None) -> int:
    """Extract campaign duration in days from the intent string.

    Supports formats like ``"2 weeks"``, ``"30 days"``, ``"1 month"``.

    Args:
        duration_str: Raw duration string from CampaignIntent.

    Returns:
        Duration in days (always ≥ 1, default 14).
    """
    if not duration_str:
        return _DEFAULT_DURATION_DAYS
    lower = duration_str.lower()
    import re
    # Match a number followed by a time unit
    match = re.search(r"(\d+)\s*(day|week|month)", lower)
    if not match:
        return _DEFAULT_DURATION_DAYS
    value = int(match.group(1))
    unit = match.group(2)
    if unit == "week":
        return value * 7
    if unit == "month":
        return value * 30
    return max(value, 1)


def _parse_frequency(frequency_str: str | None) -> int:
    """Extract posts-per-day from the intent frequency string.

    Supports formats like ``"daily"``, ``"2x per day"``, ``"3 times a week"``.

    Args:
        frequency_str: Raw posting frequency string from CampaignIntent.

    Returns:
        Posts per day (always ≥ 1, default 1).
    """
    if not frequency_str:
        return _DEFAULT_POSTS_PER_DAY
    lower = frequency_str.lower()
    import re
    # "3 times a week" → 3/7 ≈ 1/day (round up)
    week_match = re.search(r"(\d+)\s*(?:times?|x)\s*(?:a|per)\s*week", lower)
    if week_match:
        return max(1, math.ceil(int(week_match.group(1)) / 7))
    # "2x per day" or "2 times a day"
    day_match = re.search(r"(\d+)\s*(?:times?|x)\s*(?:a|per)\s*day", lower)
    if day_match:
        return max(1, int(day_match.group(1)))
    if "daily" in lower or "every day" in lower:
        return 1
    return _DEFAULT_POSTS_PER_DAY
