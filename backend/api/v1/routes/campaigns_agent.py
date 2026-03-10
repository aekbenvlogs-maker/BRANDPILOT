# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/campaigns_agent.py
# DESCRIPTION  : FastAPI routes for the Campaign Agent (AI-driven
#                campaign generation with human-in-the-loop validation).
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================
"""
Campaign Agent REST API — 6 endpoints:

  POST   /api/v1/campaigns/agent/create
  GET    /api/v1/campaigns/agent/{campaign_id}/status
  GET    /api/v1/campaigns/agent/{campaign_id}/preview
  POST   /api/v1/campaigns/agent/{campaign_id}/approve
  POST   /api/v1/campaigns/agent/{campaign_id}/posts/{post_id}/regenerate
  DELETE /api/v1/campaigns/agent/{campaign_id}

Security invariants:
  ⛔ Only authenticated owners may mutate a campaign.
  ⛔ Status transitions to 'scheduled'/'published' happen ONLY inside the
     Celery worker — never in these route handlers.
  ⛔ Rate limit: max 5 campaign creations per user per hour (Redis counter).
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.middleware.auth import get_current_user_id
from configs.settings import get_settings
from database.connection import get_db_session
from microservices.campaign_agent.agent import (
    CampaignAgent,
    CampaignNotFoundError,
    InvalidStatusError,
    UnauthorizedError,
)
from microservices.campaign_agent.intent_parser import (
    AmbiguousPromptError,
    IntentParseError,
    OpenAITimeoutError,
)
from microservices.campaign_agent.worker import celery_app

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic request / response schemas (inline — Pydantic v2)
# ---------------------------------------------------------------------------


class CreateCampaignRequest(BaseModel):
    """Request body for AI-driven campaign creation."""

    prompt: str = Field(..., min_length=10, max_length=1000)
    project_id: uuid.UUID


class CreateCampaignResponse(BaseModel):
    """Accepted response for campaign creation (202)."""

    campaign_id: uuid.UUID
    status: str = "pending_validation"
    message: str = "Campaign generation started. Poll /status for progress."


class CampaignStatusResponse(BaseModel):
    """Polling response for campaign pipeline progress."""

    campaign_id: uuid.UUID
    agent_status: str
    current_step: str | None = None
    created_at: datetime | None = None


class PostPreviewSchema(BaseModel):
    """Single social post preview (part of campaign preview)."""

    id: uuid.UUID
    platform: str
    content_text: str
    media_urls: list[str]
    hashtags: list[str]
    scheduled_at: str  # ISO-8601 UTC string from SocialPost dataclass
    status: str


class CampaignPreviewResponse(BaseModel):
    """Full campaign preview returned when status is pending_validation."""

    campaign_id: uuid.UUID
    agent_status: str
    posts: list[PostPreviewSchema]
    total_posts: int


class ApproveRequest(BaseModel):
    """Request body for approving a campaign.

    approved_post_ids: Optional explicit subset of post UUIDs to approve.
    When empty, ALL posts in pending_validation are approved.
    """

    approved_post_ids: list[uuid.UUID] = Field(default_factory=list)


class ApproveResponse(BaseModel):
    """Response after campaign approval."""

    campaign_id: uuid.UUID
    scheduled_posts: int
    message: str = "Campaign approved and posts scheduled."


class RegenerateRequest(BaseModel):
    """Request body for regenerating a single post."""

    feedback: str = Field(..., min_length=5, max_length=500)


class RegenerateResponse(BaseModel):
    """Response after post regeneration is queued."""

    post_id: uuid.UUID
    celery_task_id: str | None = None
    status: str = "pending_validation"
    message: str = "Post regeneration queued."


class CancelResponse(BaseModel):
    """Response after campaign cancellation."""

    campaign_id: uuid.UUID
    message: str = "Campaign cancelled and pending tasks revoked."


# ---------------------------------------------------------------------------
# Rate limiting dependency — max 5 campaign creations / user / hour
# ---------------------------------------------------------------------------

_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW_S = 3600  # 1 hour


async def _check_campaign_rate_limit(
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> uuid.UUID:
    """Enforce a Redis-backed rate limit: 5 campaign creations per user/hour.

    The counter is stored under the key ``campaign_agent:rate:{user_id}``
    with a 1-hour TTL.  If the limit is exceeded an HTTP 429 is raised.

    Args:
        user_id: Injected authenticated user UUID.

    Returns:
        The same user_id (pass-through for downstream dependencies).

    Raises:
        HTTPException 429: Rate limit exceeded.
        HTTPException 503: Redis unavailable (fail-open: returns user_id).
    """
    settings = get_settings()
    key = f"campaign_agent:rate:{user_id}"
    try:
        async with aioredis.from_url(settings.redis_url, decode_responses=True) as redis:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            count_str, ttl = await pipe.execute()
            count = int(count_str)
            if ttl < 0:
                # First increment — set TTL
                await redis.expire(key, _RATE_LIMIT_WINDOW_S)
            if count > _RATE_LIMIT_MAX:
                retry_after = ttl if ttl > 0 else _RATE_LIMIT_WINDOW_S
                logger.warning(
                    "[CampaignAgent] Rate limit exceeded | user={} count={}",
                    user_id,
                    count,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": (
                            f"Maximum {_RATE_LIMIT_MAX} campaign creations per "
                            "hour reached. Please try again later."
                        ),
                        "retry_after_seconds": retry_after,
                    },
                )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover — Redis unavailable
        # Fail-open: log warning but don't block the request.
        logger.warning(
            "[CampaignAgent] Redis rate-limit check failed (fail-open) | error={}",
            exc,
        )
    return user_id


# ---------------------------------------------------------------------------
# Shared error mapper — domain exceptions → HTTP responses
# ---------------------------------------------------------------------------


def _handle_domain_error(exc: Exception, campaign_id: str | None = None) -> None:
    """Map CampaignAgent domain exceptions to FastAPI HTTP exceptions.

    Args:
        exc:         The raised domain exception.
        campaign_id: Optional campaign UUID string for log context.

    Raises:
        HTTPException: Always re-raises as an HTTP error.
    """
    if isinstance(exc, AmbiguousPromptError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "AMBIGUOUS_PROMPT",
                "message": (
                    "The campaign brief is too vague. Please provide more detail."
                ),
                "clarifying_questions": exc.questions,
            },
        )
    if isinstance(exc, IntentParseError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INTENT_PARSE_ERROR",
                "message": "Failed to parse campaign intent from your prompt.",
            },
        )
    if isinstance(exc, OpenAITimeoutError):
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "AI_TIMEOUT",
                "message": "The AI service timed out. Please retry.",
            },
        )
    if isinstance(exc, CampaignNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CAMPAIGN_NOT_FOUND",
                "message": f"Campaign '{campaign_id}' not found.",
            },
        )
    if isinstance(exc, UnauthorizedError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "You do not have permission to access this campaign.",
            },
        )
    if isinstance(exc, InvalidStatusError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "INVALID_STATUS",
                "message": str(exc),
                "current_status": getattr(exc, "current_status", None),
                "expected_status": getattr(exc, "expected_status", None),
            },
        )
    # Unexpected — re-raise so the global handler can log it.
    raise exc


# ---------------------------------------------------------------------------
# Endpoint 1 — Create campaign (AI pipeline)
# ---------------------------------------------------------------------------


@router.post(
    "/create",
    response_model=CreateCampaignResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a campaign via the AI agent",
    description=(
        "Submit a natural-language brief. The agent parses intent, "
        "loads brand context, and launches a 10-step Celery pipeline. "
        "Poll `/status` to track progress. "
        "Rate-limited to 5 requests per user per hour."
    ),
)
async def create_agent_campaign(
    data: CreateCampaignRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(_check_campaign_rate_limit),
) -> CreateCampaignResponse:
    """POST /api/v1/campaigns/agent/create

    Returns HTTP 202 immediately once the pipeline has been dispatched.
    The actual campaign generation runs asynchronously in Celery workers.

    Raises:
        400: Prompt is too ambiguous (< 3 intent fields extracted).
        404: project_id does not exist.
        422: GPT-4 returned malformed JSON.
        429: Rate limit exceeded (5 creations/user/hour).
        504: OpenAI API timed out.
    """
    logger.info(
        "[routes/campaigns_agent] create | user={} project={} prompt={!r}",
        user_id,
        data.project_id,
        data.prompt[:60],
    )
    try:
        agent = CampaignAgent(db=db, celery_app=celery_app)
        campaign_id = await agent.build_campaign(
            prompt=data.prompt,
            project_id=str(data.project_id),
            user_id=str(user_id),
        )
        await db.commit()
        logger.success(
            "[routes/campaigns_agent] create OK | campaign={} user={}",
            campaign_id,
            user_id,
        )
        return CreateCampaignResponse(campaign_id=uuid.UUID(campaign_id))
    except Exception as exc:
        await db.rollback()
        _handle_domain_error(exc)


# ---------------------------------------------------------------------------
# Endpoint 2 — Poll pipeline status
# ---------------------------------------------------------------------------


@router.get(
    "/{campaign_id}/status",
    response_model=CampaignStatusResponse,
    summary="Poll campaign agent pipeline status",
    description=(
        "Returns the current `agent_status` and active pipeline step. "
        "Poll every 2-5 seconds until `agent_status == 'pending_validation'`."
    ),
)
async def get_agent_status(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> CampaignStatusResponse:
    """GET /api/v1/campaigns/agent/{campaign_id}/status

    Raises:
        404: Campaign not found.
        403: Requesting user is not the campaign owner.
    """
    from sqlalchemy import select

    from database.models_orm import Campaign, Project, WorkflowJob

    # Load campaign + owner (JOIN)
    stmt = (
        select(Campaign, Project.user_id)
        .join(Project, Campaign.project_id == Project.id)
        .where(Campaign.id == campaign_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CAMPAIGN_NOT_FOUND", "message": "Campaign not found."},
        )
    campaign, owner_id = row
    if str(owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Access denied."},
        )

    # Load most-recent agent WorkflowJob
    job_result = await db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.campaign_id == campaign_id)
        .where(WorkflowJob.job_type == "campaign_agent")
        .order_by(WorkflowJob.created_at.desc())
        .limit(1)
    )
    job = job_result.scalar_one_or_none()

    agent_status = "unknown"
    current_step: str | None = None
    if job is not None:
        agent_status = (job.result or {}).get("agent_status", "unknown")
        current_step = job.current_step

    return CampaignStatusResponse(
        campaign_id=campaign_id,
        agent_status=agent_status,
        current_step=current_step,
        created_at=campaign.created_at,
    )


# ---------------------------------------------------------------------------
# Endpoint 3 — Preview generated posts (HITL gate)
# ---------------------------------------------------------------------------


@router.get(
    "/{campaign_id}/preview",
    response_model=CampaignPreviewResponse,
    summary="Preview generated posts before approval",
    description=(
        "Returns generated posts only when `agent_status == 'pending_validation'`. "
        "Use this to render the ValidationBoard UI."
    ),
)
async def get_campaign_preview(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> CampaignPreviewResponse:
    """GET /api/v1/campaigns/agent/{campaign_id}/preview

    Raises:
        403: Campaign is not in pending_validation status yet.
        403: Requesting user is not the campaign owner.
        404: Campaign not found.
    """
    from sqlalchemy import select

    from database.models_orm import Campaign, Project, WorkflowJob

    stmt = (
        select(Campaign, Project.user_id)
        .join(Project, Campaign.project_id == Project.id)
        .where(Campaign.id == campaign_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CAMPAIGN_NOT_FOUND", "message": "Campaign not found."},
        )
    campaign, owner_id = row  # noqa: F841
    if str(owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Access denied."},
        )

    job_result = await db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.campaign_id == campaign_id)
        .where(WorkflowJob.job_type == "campaign_agent")
        .order_by(WorkflowJob.created_at.desc())
        .limit(1)
    )
    job = job_result.scalar_one_or_none()
    agent_status = (job.result or {}).get("agent_status", "unknown") if job else "unknown"

    if agent_status != "pending_validation":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "NOT_READY",
                "message": (
                    f"Campaign preview is only available when status is "
                    f"'pending_validation'. Current status: '{agent_status}'."
                ),
                "current_status": agent_status,
            },
        )

    raw_posts: list[dict[str, Any]] = (job.result or {}).get("posts", []) if job else []
    posts = [
        PostPreviewSchema(
            id=uuid.UUID(p["id"]),
            platform=p.get("platform", ""),
            content_text=p.get("content_text", ""),
            media_urls=p.get("media_urls", []),
            hashtags=p.get("hashtags", []),
            scheduled_at=p.get("scheduled_at", ""),
            status=p.get("status", "draft"),
        )
        for p in raw_posts
    ]

    return CampaignPreviewResponse(
        campaign_id=campaign_id,
        agent_status=agent_status,
        posts=posts,
        total_posts=len(posts),
    )


# ---------------------------------------------------------------------------
# Endpoint 4 — Approve campaign (HITL approval gate)
# ---------------------------------------------------------------------------


@router.post(
    "/{campaign_id}/approve",
    response_model=ApproveResponse,
    summary="Approve generated campaign and schedule posts",
    description=(
        "Human-in-the-loop approval gate. "
        "Transitions campaign to 'active' and schedules all posts via Celery ETA tasks. "
        "Optional: pass `approved_post_ids` to approve only a subset."
    ),
)
async def approve_campaign(
    campaign_id: uuid.UUID,
    data: ApproveRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> ApproveResponse:
    """POST /api/v1/campaigns/agent/{campaign_id}/approve

    Raises:
        403: Requesting user is not the campaign owner.
        404: Campaign not found.
        409: Campaign is not in 'pending_validation' status.
    """
    logger.info(
        "[routes/campaigns_agent] approve | user={} campaign={}",
        user_id,
        campaign_id,
    )
    try:
        agent = CampaignAgent(db=db, celery_app=celery_app)
        await agent.approve_and_schedule(
            campaign_id=str(campaign_id),
            user_id=str(user_id),
        )
        await db.commit()

        # Count scheduled posts from the updated WorkflowJob
        from sqlalchemy import select

        from database.models_orm import WorkflowJob

        job_result = await db.execute(
            select(WorkflowJob)
            .where(WorkflowJob.campaign_id == campaign_id)
            .where(WorkflowJob.job_type == "campaign_agent")
            .order_by(WorkflowJob.created_at.desc())
            .limit(1)
        )
        job = job_result.scalar_one_or_none()
        scheduled = len((job.result or {}).get("task_ids", [])) if job else 0

        logger.success(
            "[routes/campaigns_agent] approve OK | campaign={} scheduled={}",
            campaign_id,
            scheduled,
        )
        return ApproveResponse(campaign_id=campaign_id, scheduled_posts=scheduled)
    except Exception as exc:
        await db.rollback()
        _handle_domain_error(exc, str(campaign_id))


# ---------------------------------------------------------------------------
# Endpoint 5 — Regenerate a single post with feedback
# ---------------------------------------------------------------------------


@router.post(
    "/{campaign_id}/posts/{post_id}/regenerate",
    response_model=RegenerateResponse,
    summary="Regenerate a single post with user feedback",
    description=(
        "Queues a Celery regeneration task for one post. "
        "The campaign status remains 'pending_validation'. "
        "Poll /preview to see the updated post once generation completes."
    ),
)
async def regenerate_post(
    campaign_id: uuid.UUID,
    post_id: uuid.UUID,
    data: RegenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> RegenerateResponse:
    """POST /api/v1/campaigns/agent/{campaign_id}/posts/{post_id}/regenerate

    Raises:
        403: Requesting user is not the campaign owner.
        404: Campaign not found.
    """
    logger.info(
        "[routes/campaigns_agent] regenerate | user={} campaign={} post={}",
        user_id,
        campaign_id,
        post_id,
    )
    try:
        agent = CampaignAgent(db=db, celery_app=celery_app)
        updated_post = await agent.reject_and_regenerate(
            campaign_id=str(campaign_id),
            post_id=str(post_id),
            feedback=data.feedback,
            user_id=str(user_id),
        )
        logger.success(
            "[routes/campaigns_agent] regenerate queued | post={} task={}",
            post_id,
            updated_post.celery_task_id,
        )
        return RegenerateResponse(
            post_id=uuid.UUID(updated_post.id),
            celery_task_id=updated_post.celery_task_id,
            status=updated_post.status,
        )
    except Exception as exc:
        _handle_domain_error(exc, str(campaign_id))


# ---------------------------------------------------------------------------
# Endpoint 6 — Cancel campaign
# ---------------------------------------------------------------------------


@router.delete(
    "/{campaign_id}",
    response_model=CancelResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a campaign and revoke pending Celery tasks",
    description=(
        "Cancels the campaign and revokes all Celery ETA tasks scheduled "
        "more than 5 minutes in the future. "
        "Already-published posts are preserved (immutable audit trail). "
        "Returns 409 if any posts have already been published."
    ),
)
async def cancel_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> CancelResponse:
    """DELETE /api/v1/campaigns/agent/{campaign_id}

    Raises:
        403: Requesting user is not the campaign owner.
        404: Campaign not found.
        409: One or more posts have already been published.
    """
    from sqlalchemy import select

    from database.models_orm import WorkflowJob

    logger.info(
        "[routes/campaigns_agent] cancel | user={} campaign={}",
        user_id,
        campaign_id,
    )

    # Guard: refuse cancellation if any post is already published
    job_result = await db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.campaign_id == campaign_id)
        .where(WorkflowJob.job_type == "campaign_agent")
        .order_by(WorkflowJob.created_at.desc())
        .limit(1)
    )
    job = job_result.scalar_one_or_none()
    if job is not None:
        raw_posts: list[dict[str, Any]] = (job.result or {}).get("posts", [])
        published = [p for p in raw_posts if p.get("status") == "published"]
        if published:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "POSTS_ALREADY_PUBLISHED",
                    "message": (
                        f"{len(published)} post(s) have already been published "
                        "and cannot be revoked. Cancel is blocked."
                    ),
                    "published_post_ids": [p["id"] for p in published],
                },
            )

    try:
        agent = CampaignAgent(db=db, celery_app=celery_app)
        await agent.cancel_campaign(
            campaign_id=str(campaign_id),
            user_id=str(user_id),
        )
        await db.commit()
        logger.success(
            "[routes/campaigns_agent] cancel OK | campaign={}", campaign_id
        )
        return CancelResponse(campaign_id=campaign_id)
    except Exception as exc:
        await db.rollback()
        _handle_domain_error(exc, str(campaign_id))
