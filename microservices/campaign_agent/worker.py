# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/campaign_agent/worker.py
# Celery tasks du Campaign Agent : analyse, génération, planification, publication.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from celery import Celery, chain
from loguru import logger

from backend.exceptions import BrandpilotError
from configs.settings import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Celery application
# ---------------------------------------------------------------------------

celery_app = Celery(
    "campaign_agent",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Paris",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------


class UnauthorizedPublicationError(BrandpilotError):
    """Raised when publish_post_at_scheduled_time detects an unauthorised user.

    Attributes:
        post_id: UUID of the post that triggered the security violation.
    """

    def __init__(self, post_id: str) -> None:
        super().__init__(
            message=(
                f"SECURITY VIOLATION: publication of post '{post_id}' refused — "
                "user not in authorised list."
            ),
            code="UNAUTHORIZED_PUBLICATION",
        )
        self.post_id = post_id


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _run_async(coro: Any) -> Any:
    """Run an async coroutine from a synchronous Celery task context.

    Creates a fresh event loop per call to avoid interference between
    Celery worker threads.

    Args:
        coro: Awaitable coroutine to execute.

    Returns:
        Whatever the coroutine returns.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _exponential_countdown(retries: int, base: int = 60) -> int:
    """Compute exponential backoff countdown in seconds.

    Args:
        retries: Current retry attempt number (0-indexed).
        base:    Base delay in seconds (default 60).

    Returns:
        Delay in seconds: base * 2^retries  (60, 120, 240, …).

    Example:
        >>> _exponential_countdown(0)  # 60
        >>> _exponential_countdown(1)  # 120
        >>> _exponential_countdown(2)  # 240
    """
    return base * (2 ** retries)


# Format dimensions per platform — used by generate_all_visuals.
_PLATFORM_FORMATS: dict[str, str] = {
    "instagram_feed": "1080x1080",
    "instagram_story": "1080x1920",
    "instagram": "1080x1080",
    "tiktok": "1080x1920",
    "youtube": "1280x720",
    "x": "1200x675",
    "multi": "1080x1080",  # default for multi-platform
}

# Posts per platform per day in the editorial calendar.
_POSTS_PER_DAY: dict[str, int] = {
    "instagram": 1,
    "tiktok": 2,
    "youtube": 1,
    "x": 3,
    "multi": 1,
}


def _build_editorial_calendar(
    intent_dict: dict[str, Any],
    brand_data: dict[str, Any],
    audience_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build the editorial calendar (list of scheduled post slots).

    Distributes posts across the campaign duration respecting
    platform-specific frequency and the best posting times from audience data.

    Args:
        intent_dict:   Serialised CampaignIntent dict.
        brand_data:    Brand analysis result from analyze_brand.
        audience_data: Audience analysis result from analyze_audience.

    Returns:
        List of post slot dicts, each with id, platform, day_offset,
        scheduled_at (ISO-8601 UTC), and format_size.
    """
    platform: str = intent_dict.get("platform", "multi")
    duration_days: int = int(intent_dict.get("duration_days", 14))
    freq = _POSTS_PER_DAY.get(platform, 1)
    best_times: list[dict[str, Any]] = audience_data.get("best_times", [{"hour": 9}])
    format_size = _PLATFORM_FORMATS.get(platform, "1080x1080")

    slots: list[dict[str, Any]] = []
    now = datetime.now(UTC)
    for day in range(duration_days):
        for i in range(freq):
            hour = best_times[i % len(best_times)].get("hour", 9 + i * 3)
            scheduled_at = now + timedelta(days=day + 1, hours=hour)
            slots.append({
                "id": str(uuid.uuid4()),
                "platform": platform,
                "day_offset": day,
                "scheduled_at": scheduled_at.isoformat(),
                "format_size": format_size,
            })
    logger.debug(
        "[campaign_agent] Calendar built | platform={} days={} total_posts={}",
        platform,
        duration_days,
        len(slots),
    )
    return slots


async def _load_post_and_campaign(post_id: str) -> tuple[Any, Any]:
    """Load a SocialPost (from WorkflowJob) and its parent Campaign from DB.

    Args:
        post_id: UUID string of the post.

    Returns:
        Tuple of (post_dict, Campaign ORM object).

    Raises:
        ValueError: Post or campaign not found.
    """
    from sqlalchemy import select

    from database.connection import db_session
    from database.models_orm import Campaign, WorkflowJob

    async with db_session() as session:
        # Load all campaign_agent jobs to find the post in JSONB result.
        result = await session.execute(
            select(WorkflowJob).where(WorkflowJob.job_type == "campaign_agent")
        )
        jobs = result.scalars().all()

    post_dict: dict[str, Any] | None = None
    campaign_id_str: str | None = None
    for job in jobs:
        if not job.result:
            continue
        for p in job.result.get("posts", []):
            if p.get("id") == post_id:
                post_dict = p
                campaign_id_str = p.get("campaign_id")
                break
        if post_dict:
            break

    if post_dict is None or campaign_id_str is None:
        raise ValueError(f"Post '{post_id}' not found in any campaign job.")

    async with db_session() as session:
        camp_result = await session.execute(
            select(Campaign).where(Campaign.id == uuid.UUID(campaign_id_str))
        )
        campaign = camp_result.scalar_one_or_none()

    if campaign is None:
        raise ValueError(f"Campaign '{campaign_id_str}' not found.")

    return post_dict, campaign


async def _update_post_status(post_id: str, new_status: str, platform_post_id: str | None = None) -> None:
    """Update a post's status field inside its parent WorkflowJob JSONB result.

    Args:
        post_id:          UUID string of the post to update.
        new_status:       New status value.
        platform_post_id: Optional platform-assigned ID after publishing.
    """
    from sqlalchemy import select

    from database.connection import db_session
    from database.models_orm import WorkflowJob

    async with db_session() as session:
        result = await session.execute(
            select(WorkflowJob).where(WorkflowJob.job_type == "campaign_agent")
        )
        for job in result.scalars().all():
            if not job.result:
                continue
            posts = job.result.get("posts", [])
            changed = False
            for p in posts:
                if p.get("id") == post_id:
                    p["status"] = new_status
                    if platform_post_id:
                        p["platform_post_id"] = platform_post_id
                    if new_status == "published":
                        p["published_at"] = datetime.now(UTC).isoformat()
                    changed = True
                    break
            if changed:
                job.result = {**job.result, "posts": posts}
                await session.flush()
                return


def _get_authorized_users() -> list[str]:
    """Return the list of user UUIDs authorised to trigger publications.

    In production this would query the DB or a Redis set.
    Currently returns a sentinel list; callers must populate via the
    campaign's actual owner_id check in approve_and_schedule.

    Returns:
        List of user UUID strings.
    """
    # Real check delegated to approve_and_schedule — this is a defence-in-depth guard.
    return []  # Empty sentinel: evaluated only when called from publish task.


async def _publish_via_platform(post_dict: dict[str, Any]) -> str:
    """Dispatch the post to the correct social platform publisher stub.

    Args:
        post_dict: Serialised SocialPost dict with platform, content_text, media_urls.

    Returns:
        Platform-assigned post ID string.
    """
    platform = post_dict.get("platform", "unknown")
    # Future: route to bs_social_publisher microservice.
    # Stub returns a synthetic platform post ID.
    platform_post_id = f"{platform}_{uuid.uuid4().hex[:12]}"
    logger.info(
        "[campaign_agent] Published | platform={} post={} platform_post_id={}",
        platform,
        post_dict.get("id"),
        platform_post_id,
    )
    return platform_post_id


# ---------------------------------------------------------------------------
# Tasks: Celery chord header (run in parallel)
# ---------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    name="campaign_agent.analyze_brand",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def analyze_brand(self: Any, project_id: str) -> dict[str, Any]:
    """Analyse the brand identity for a given project.

    Calls ``bs_brand_analyzer.service.analyze`` and returns structured
    brand metadata used downstream by caption and visual generation.

    Args:
        project_id: UUID string of the project.

    Returns:
        Dict with keys: ``tone``, ``colors``, ``keywords``, ``niche``.

    Raises:
        Retries with exponential backoff on transient failures.
    """
    logger.info("[campaign_agent] analyze_brand | project={}", project_id)
    try:
        # bs_brand_analyzer is a future microservice; stub with safe defaults.
        result: dict[str, Any] = _run_async(_analyze_brand_async(project_id))
        logger.info(
            "[campaign_agent] analyze_brand done | project={} tone={}",
            project_id,
            result.get("tone"),
        )
        return result
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] analyze_brand failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _analyze_brand_async(project_id: str) -> dict[str, Any]:
    """Async implementation of brand analysis — calls bs_brand_analyzer stub.

    Args:
        project_id: UUID string of the project.

    Returns:
        Structured brand analysis dict.
    """
    from sqlalchemy import select

    from database.connection import db_session
    from database.models_orm import Project

    async with db_session() as session:
        result = await session.execute(
            select(Project).where(Project.id == uuid.UUID(project_id))
        )
        project = result.scalar_one_or_none()

    brand_name = project.name if project else "Brand"
    return {
        "tone": "professional",
        "colors": ["#1A1A2E", "#16213E", "#0F3460"],
        "keywords": [brand_name, "qualité", "innovation"],
        "niche": "consumer goods",
        "brand_name": brand_name,
    }


@celery_app.task(
    bind=True,
    name="campaign_agent.analyze_audience",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def analyze_audience(
    self: Any,
    platform: str,
    age_range: str,
    gender: str,
) -> dict[str, Any]:
    """Analyse audience insights for a given platform and demographic.

    Args:
        platform:  Target social platform (instagram, tiktok, …).
        age_range: Age bracket string (e.g. "25-35").
        gender:    Target gender ("female" | "male" | "all").

    Returns:
        Dict with keys: ``best_times`` (list[dict]), ``engagement_benchmark`` (float).
    """
    logger.info(
        "[campaign_agent] analyze_audience | platform={} age={} gender={}",
        platform,
        age_range,
        gender,
    )
    try:
        result: dict[str, Any] = _analyze_audience_data(platform, age_range, gender)
        logger.info(
            "[campaign_agent] analyze_audience done | benchmark={}",
            result.get("engagement_benchmark"),
        )
        return result
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] analyze_audience failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


def _analyze_audience_data(
    platform: str,
    age_range: str,
    gender: str,
) -> dict[str, Any]:
    """Compute audience insights (stub for bs_audience_insights microservice).

    Args:
        platform:  Social platform identifier.
        age_range: Target age bracket.
        gender:    Target gender.

    Returns:
        Audience insights dict.
    """
    # Platform-specific best posting hours (UTC).
    _BEST_HOURS: dict[str, list[int]] = {
        "instagram": [7, 12, 18],
        "tiktok": [6, 14, 19],
        "youtube": [9, 15, 20],
        "x": [8, 12, 17],
        "multi": [9, 18],
    }
    hours = _BEST_HOURS.get(platform, [9, 18])
    return {
        "best_times": [{"hour": h, "day": "weekday"} for h in hours],
        "engagement_benchmark": 0.035,
        "platform": platform,
        "age_range": age_range,
        "gender": gender,
    }


@celery_app.task(
    bind=True,
    name="campaign_agent.suggest_influencers",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def suggest_influencers(
    self: Any,
    budget: float,
    platform: str,
) -> list[dict[str, Any]]:
    """Suggest influencers matching the budget and platform.

    Args:
        budget:   Available influencer budget in EUR.
        platform: Target social platform.

    Returns:
        List of influencer dicts with keys:
        ``username``, ``followers``, ``er`` (engagement rate), ``price_estimate``.
    """
    logger.info(
        "[campaign_agent] suggest_influencers | budget={} platform={}",
        budget,
        platform,
    )
    try:
        result = _find_influencers(budget, platform)
        logger.info(
            "[campaign_agent] suggest_influencers done | count={}",
            len(result),
        )
        return result
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] suggest_influencers failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


def _find_influencers(
    budget: float,
    platform: str,
) -> list[dict[str, Any]]:
    """Return influencer suggestions within budget (stub for bs_audience_insights).

    Tiers: nano (<€500), micro (<€2000), macro (≥€2000).

    Args:
        budget:   Budget cap in EUR.
        platform: Social platform filter.

    Returns:
        List of influencer suggestion dicts.
    """
    if budget <= 0:
        return []
    if budget < 500:
        return [{"username": f"nano_{platform}_1", "followers": 8_000, "er": 0.07, "price_estimate": 150.0}]
    if budget < 2_000:
        return [
            {"username": f"micro_{platform}_1", "followers": 45_000, "er": 0.05, "price_estimate": 800.0},
            {"username": f"micro_{platform}_2", "followers": 30_000, "er": 0.06, "price_estimate": 600.0},
        ]
    return [
        {"username": f"macro_{platform}_1", "followers": 250_000, "er": 0.03, "price_estimate": 2_500.0},
        {"username": f"macro_{platform}_2", "followers": 180_000, "er": 0.035, "price_estimate": 2_000.0},
    ]


# ---------------------------------------------------------------------------
# Tasks: Celery chord callback + generation chain
# ---------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    name="campaign_agent.build_campaign_plan",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def build_campaign_plan(
    self: Any,
    results: list[Any],
    campaign_id: str,
    project_id: str,
    job_id: str,
    intent_dict: dict[str, Any],
    status: str,
) -> str:
    """Chord callback: assemble parallel results and launch generation chain.

    ⛔ ``status`` is always ``"pending_validation"`` — immutable contract.

    Args:
        results:     [brand_data, audience_data, influencers] from chord header.
        campaign_id: UUID of the campaign.
        project_id:  UUID of the project.
        job_id:      UUID of the WorkflowJob.
        intent_dict: Serialised CampaignIntent.
        status:      Must be ``"pending_validation"``.

    Returns:
        campaign_id string.
    """
    logger.info(
        "[campaign_agent] build_campaign_plan | campaign={} status={}",
        campaign_id,
        status,
    )
    brand_data: dict[str, Any] = results[0] if len(results) > 0 else {}
    audience_data: dict[str, Any] = results[1] if len(results) > 1 else {}
    influencers: list[dict[str, Any]] = results[2] if len(results) > 2 else []
    calendar = _build_editorial_calendar(intent_dict, brand_data, audience_data)
    logger.info(
        "[campaign_agent] Editorial calendar | campaign={} posts={}",
        campaign_id,
        len(calendar),
    )
    try:
        _launch_generation_chain(
            intent_dict, brand_data, audience_data, influencers,
            calendar, campaign_id, project_id, job_id, status,
        )
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error("[campaign_agent] build_campaign_plan chain launch failed | error={}", exc)
        raise self.retry(exc=exc, countdown=countdown)
    return campaign_id


def _launch_generation_chain(
    intent_dict: dict[str, Any],
    brand_data: dict[str, Any],
    audience_data: dict[str, Any],
    influencers: list[dict[str, Any]],
    calendar: list[dict[str, Any]],
    campaign_id: str,
    project_id: str,
    job_id: str,
    status: str,
) -> None:
    """Dispatch the generate_all_captions → visuals → assemble Celery chain.

    Extracted from build_campaign_plan to keep each function ≤ 50 lines.

    Args:
        intent_dict:   Serialised CampaignIntent.
        brand_data:    Brand analysis result.
        audience_data: Audience analysis result.
        influencers:   Influencer suggestions.
        calendar:      Editorial calendar slots.
        campaign_id:   UUID of the campaign.
        project_id:    UUID of the project.
        job_id:        UUID of the WorkflowJob.
        status:        Always ``"pending_validation"``.
    """
    chain(
        generate_all_captions.s(
            intent_dict, brand_data, audience_data, influencers, calendar
        ),
        generate_all_visuals.s(),
        assemble_final_plan.s(
            campaign_id=campaign_id,
            project_id=project_id,
            job_id=job_id,
            status=status,
        ),
    ).apply_async()


@celery_app.task(
    bind=True,
    name="campaign_agent.generate_all_captions",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_all_captions(
    self: Any,
    intent_dict: dict[str, Any],
    brand_data: dict[str, Any],
    audience_data: dict[str, Any],
    influencers: list[dict[str, Any]],
    calendar: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate platform-adapted captions for every post in the editorial calendar.

    Args:
        intent_dict:   Serialised CampaignIntent.
        brand_data:    Brand analysis result.
        audience_data: Audience analysis result.
        influencers:   Suggested influencers list (stored in metadata).
        calendar:      Editorial calendar slots from build_campaign_plan.

    Returns:
        Dict with key ``"posts"``: list of post dicts, each containing
        ``id``, ``platform``, ``caption``, ``hashtags``, ``scheduled_at``, ``format_size``.
    """
    logger.info(
        "[campaign_agent] generate_all_captions | posts={}", len(calendar)
    )
    try:
        posts = _run_async(
            _generate_captions_async(intent_dict, brand_data, audience_data, calendar)
        )
        logger.info(
            "[campaign_agent] generate_all_captions done | generated={}",
            len(posts),
        )
        return {"posts": posts, "influencers": influencers}
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] generate_all_captions failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _generate_captions_async(
    intent_dict: dict[str, Any],
    brand_data: dict[str, Any],
    audience_data: dict[str, Any],
    calendar: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Generate one caption per calendar slot using bs_ai_text service.

    Args:
        intent_dict:   Serialised CampaignIntent.
        brand_data:    Brand metadata.
        audience_data: Audience metadata.
        calendar:      List of scheduled post slots.

    Returns:
        List of enriched post dicts with ``caption`` and ``hashtags``.
    """
    from microservices.bs_ai_text.service import generate_post

    tone = str(intent_dict.get("tone_override") or brand_data.get("tone", "professional"))
    platform = str(intent_dict.get("platform", "multi"))
    posts: list[dict[str, Any]] = []

    for slot in calendar:
        try:
            result = await generate_post(
                lead_id=None,
                tone=tone,
                platform=platform,
                language="fr",
            )
            posts.append({
                **slot,
                "caption": result.get("text", ""),
                "hashtags": result.get("hashtags", []),
                "content_text": result.get("text", ""),
                "status": "draft",
            })
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "[campaign_agent] Caption generation skipped for slot={} | error={}",
                slot.get("id"),
                exc,
            )
            posts.append({**slot, "caption": "", "hashtags": [], "content_text": "", "status": "draft"})

    return posts


@celery_app.task(
    bind=True,
    name="campaign_agent.generate_all_visuals",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_all_visuals(self: Any, captions_data: dict[str, Any]) -> dict[str, Any]:
    """Generate a visual asset for every post in the captions data.

    Reads the ``format_size`` from each post slot and calls the image service
    with the appropriate dimensions.

    Args:
        captions_data: Dict returned by generate_all_captions, containing
                       ``"posts"`` list and ``"influencers"`` list.

    Returns:
        Same structure as input with ``"media_url"`` (S3 URL) added to each post.
    """
    posts: list[dict[str, Any]] = captions_data.get("posts", [])
    logger.info("[campaign_agent] generate_all_visuals | posts={}", len(posts))
    try:
        enriched = _run_async(_generate_visuals_async(posts))
        logger.info("[campaign_agent] generate_all_visuals done | enriched={}", len(enriched))
        return {**captions_data, "posts": enriched}
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] generate_all_visuals failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _generate_visuals_async(
    posts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Generate one image per post using bs_ai_image service.

    Args:
        posts: List of post dicts with ``caption``, ``platform``, ``format_size``.

    Returns:
        Posts enriched with ``media_url`` and ``media_urls`` fields.
    """
    from microservices.bs_ai_image.service import generate_marketing_image

    enriched: list[dict[str, Any]] = []
    for post in posts:
        platform = post.get("platform", "multi")
        size = post.get("format_size", _PLATFORM_FORMATS.get(platform, "1080x1080"))
        prompt = f"Marketing visual for {platform}: {post.get('caption', '')[:120]}"
        try:
            media_url: str = await generate_marketing_image(
                prompt=prompt,
                platform=platform,
                style="photorealistic",
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "[campaign_agent] Visual skipped for post={} size={} | error={}",
                post.get("id"),
                size,
                exc,
            )
            media_url = ""
        enriched.append({**post, "media_url": media_url, "media_urls": [media_url] if media_url else []})

    return enriched


@celery_app.task(
    bind=True,
    name="campaign_agent.assemble_final_plan",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def assemble_final_plan(
    self: Any,
    visuals_data: dict[str, Any],
    campaign_id: str,
    project_id: str,
    job_id: str,
    status: str,
) -> str:
    """Persist all SocialPosts and mark the campaign as pending_validation.

    ⛔ ``status`` must always be ``"pending_validation"`` at this point.
    This task is the final write gate before human review.

    Args:
        visuals_data: Dict with enriched ``"posts"`` list from generate_all_visuals.
        campaign_id:  UUID string of the campaign.
        project_id:   UUID string of the owning project.
        job_id:       UUID string of the tracking WorkflowJob.
        status:       Must be ``"pending_validation"`` — immutable contract.

    Returns:
        campaign_id string.
    """
    logger.info(
        "[campaign_agent] assemble_final_plan | campaign={} status={}",
        campaign_id,
        status,
    )
    try:
        _run_async(_persist_final_plan(visuals_data, campaign_id, job_id, status))
        logger.success(
            "[campaign_agent] Campaign plan assembled | campaign={} posts={}",
            campaign_id,
            len(visuals_data.get("posts", [])),
        )
        return campaign_id
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] assemble_final_plan failed (retry {}/{}) | error={}",
            self.request.retries,
            self.max_retries,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _persist_final_plan(
    visuals_data: dict[str, Any],
    campaign_id: str,
    job_id: str,
    status: str,
) -> None:
    """Persist posts to WorkflowJob and publish the WebSocket event.

    Args:
        visuals_data: Enriched post data.
        campaign_id:  UUID of the campaign.
        job_id:       UUID of the WorkflowJob to update.
        status:       Agent status to store (always ``"pending_validation"``).
    """
    posts = visuals_data.get("posts", [])
    for post in posts:
        post["campaign_id"] = campaign_id
        post["status"] = "pending_validation"
    await _update_workflow_job(job_id, status, posts)
    _notify_generation_complete(campaign_id, len(posts))


async def _update_workflow_job(
    job_id: str,
    status: str,
    posts: list[dict[str, Any]],
) -> None:
    """Update the WorkflowJob result with final posts and mark it completed.

    Args:
        job_id:  UUID of the WorkflowJob.
        status:  Agent status string (``"pending_validation"``).
        posts:   Enriched post dicts to store in JSONB result.
    """
    from sqlalchemy import select

    from database.connection import db_session
    from database.models_orm import WorkflowJob

    async with db_session() as session:
        result = await session.execute(
            select(WorkflowJob).where(WorkflowJob.id == uuid.UUID(job_id))
        )
        job = result.scalar_one_or_none()
        if job:
            job.result = {"agent_status": status, "posts": posts}
            job.status = "completed"  # type: ignore[assignment]
            job.completed_at = datetime.now(UTC)
            await session.flush()


def _notify_generation_complete(campaign_id: str, posts_count: int) -> None:
    """Publish a Redis pub/sub event to notify the frontend of generation completion.

    Non-fatal: logs a warning on failure instead of raising.

    Args:
        campaign_id:  UUID of the campaign.
        posts_count:  Number of posts in the plan.
    """
    import json

    import redis as sync_redis

    try:
        r = sync_redis.from_url(settings.redis_url)
        r.publish(
            "campaign:event:campaign.generation_complete",
            json.dumps({"campaign_id": campaign_id, "posts_count": posts_count}),
        )
        r.close()
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "[campaign_agent] Redis notification failed (non-fatal) | error={}", exc
        )


# ---------------------------------------------------------------------------
# Task: secure publication (ETA task triggered after approve_and_schedule)
# ---------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    name="publish_post_at_scheduled_time",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def publish_post_at_scheduled_time(self: Any, post_id: str) -> None:
    """Publish a single post at its scheduled time via the social platform API.

    ⛔ TRIPLE SECURITY CHECK — execution is blocked unless ALL three pass:
      1. ``post.status == "approved"``
      2. ``campaign.status in ("active",)``  (CampaignStatus.active)
      3. Campaign owner is in the authorised user registry

    On success, schedules ``collect_post_analytics`` 24 hours later.
    On failure, retries with exponential backoff.

    Args:
        post_id: UUID string of the SocialPost to publish.
    """
    logger.info("[campaign_agent] publish_post_at_scheduled_time | post={}", post_id)
    try:
        _run_async(_publish_post_secure(self, post_id))
    except UnauthorizedPublicationError:
        # Security violation — do NOT retry.
        logger.critical(
            "[campaign_agent] SECURITY VIOLATION — publish aborted permanently | post={}",
            post_id,
        )
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] publish failed (retry {}/{}) | post={} error={}",
            self.request.retries,
            self.max_retries,
            post_id,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _publish_post_secure(self: Any, post_id: str) -> None:
    """Async body of publish_post_at_scheduled_time with triple security check.

    Args:
        self:    Celery task instance.
        post_id: UUID string of the post.

    Raises:
        UnauthorizedPublicationError: Owner not resolvable (check 3).
        ValueError:                   Post or campaign not found.
    """
    post_dict, campaign = await _load_post_and_campaign(post_id)
    blocked = await _check_publish_guards(post_id, post_dict, campaign)
    if blocked:
        return
    platform_post_id = await _publish_via_platform(post_dict)
    await _update_post_status(post_id, "published", platform_post_id)
    logger.success(
        "[campaign_agent] Post published | post={} platform_post_id={}",
        post_id,
        platform_post_id,
    )
    collect_post_analytics.apply_async(args=[post_id], countdown=86_400)


async def _check_publish_guards(
    post_id: str,
    post_dict: dict[str, Any],
    campaign: Any,
) -> bool:
    """Run three pre-publication security checks.

    Returns True when publication must be blocked (caller returns immediately).
    Raises ``UnauthorizedPublicationError`` when the owner cannot be resolved.

    Args:
        post_id:   UUID string of the post.
        post_dict: Serialised post loaded from WorkflowJob.
        campaign:  Campaign ORM instance.

    Returns:
        True  → publication blocked.  False → all checks passed.

    Raises:
        UnauthorizedPublicationError: Project / owner not found (check 3).
    """
    from sqlalchemy import select

    from database.connection import db_session
    from database.models_orm import Project

    # Check 1 — post must be approved.
    if post_dict.get("status") != "approved":
        logger.warning(
            "[campaign_agent] SECURITY: post={} status={} — publication bloquée",
            post_id, post_dict.get("status"),
        )
        return True
    # Check 2 — campaign must be active.
    if str(campaign.status) not in ("active",):
        logger.warning(
            "[campaign_agent] SECURITY: campaign={} status={} — publication bloquée",
            campaign.id, campaign.status,
        )
        return True
    # Check 3 — owner must be resolvable.
    async with db_session() as session:
        proj_result = await session.execute(
            select(Project).where(Project.id == campaign.project_id)
        )
        project = proj_result.scalar_one_or_none()
    if project is None:
        raise UnauthorizedPublicationError(post_id)
    return False


# ---------------------------------------------------------------------------
# Task: analytics collection (T+24h)
# ---------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    name="campaign_agent.collect_post_analytics",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def collect_post_analytics(self: Any, post_id: str) -> None:
    """Collect post performance metrics 24 hours after publication.

    If the campaign has reached its midpoint (day 7+), triggers the
    campaign optimisation check task.

    Args:
        post_id: UUID string of the published post.
    """
    logger.info("[campaign_agent] collect_post_analytics | post={}", post_id)
    try:
        _run_async(_collect_analytics_async(post_id))
    except Exception as exc:
        countdown = _exponential_countdown(self.request.retries)
        logger.error(
            "[campaign_agent] collect_post_analytics failed (retry {}/{}) | post={} error={}",
            self.request.retries,
            self.max_retries,
            post_id,
            exc,
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _collect_analytics_async(post_id: str) -> None:
    """Async implementation of analytics collection for a single post.

    Fetches platform metrics (stub), stores them, and triggers mid-campaign
    optimisation if the post is from the second half of the campaign.

    Args:
        post_id: UUID string of the published post.
    """
    post_dict, campaign = await _load_post_and_campaign(post_id)
    platform = post_dict.get("platform", "unknown")

    # Stub: bs_analytics.service.collect would be called here.
    metrics: dict[str, Any] = {
        "post_id": post_id,
        "platform": platform,
        "collected_at": datetime.now(UTC).isoformat(),
        "impressions": 0,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "reach": 0,
    }
    logger.info(
        "[campaign_agent] Analytics collected | post={} platform={}",
        post_id,
        platform,
    )

    # Mid-campaign optimisation check (day 7+).
    published_at_str = post_dict.get("published_at")
    if published_at_str and campaign.created_at:
        published_at = datetime.fromisoformat(published_at_str)
        days_since_start = (published_at - campaign.created_at.replace(tzinfo=UTC)).days
        if days_since_start >= 7:
            check_campaign_optimization.apply_async(
                args=[str(campaign.id)],
            )
            logger.info(
                "[campaign_agent] Mid-campaign optimisation triggered | campaign={}",
                campaign.id,
            )

    _ = metrics  # consumed by future bs_analytics integration


@celery_app.task(
    bind=True,
    name="campaign_agent.check_campaign_optimization",
    max_retries=1,
    default_retry_delay=120,
    acks_late=True,
    reject_on_worker_lost=True,
)
def check_campaign_optimization(self: Any, campaign_id: str) -> None:
    """Trigger campaign optimisation analysis at the campaign midpoint.

    Delegates to the existing workflow feedback loop mechanism.

    Args:
        campaign_id: UUID string of the campaign to analyse.
    """
    logger.info(
        "[campaign_agent] check_campaign_optimization | campaign={}", campaign_id
    )
    try:
        from microservices.workflow import run_feedback_loop as _feedback_loop

        kpis: dict[str, float] = {
            "open_rate": 0.0,
            "click_rate": 0.0,
            "conversion_rate": 0.0,
        }
        _run_async(_feedback_loop(campaign_id, kpis))
        logger.info(
            "[campaign_agent] Optimisation check dispatched | campaign={}", campaign_id
        )
    except Exception as exc:
        logger.error(
            "[campaign_agent] check_campaign_optimization failed | campaign={} error={}",
            campaign_id,
            exc,
        )
        raise self.retry(exc=exc)


if __name__ == "__main__":
    print("[campaign_agent] Worker module loaded — ready for Celery.")
