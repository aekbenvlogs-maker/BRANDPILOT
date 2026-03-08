# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_text/worker.py
# DESCRIPTION  : Celery task wrappers for AI text generation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Optional

from celery import Celery
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Celery application
# ---------------------------------------------------------------------------
celery_app = Celery(
    "bs_ai_text",
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
    task_max_retries=3,
    task_default_retry_delay=30,  # seconds
)


def _run_async(coro: Any) -> Any:
    """Run an async coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="bs_ai_text.generate_post",
    max_retries=3,
    default_retry_delay=30,
)
def task_generate_post(
    self: Any,
    lead_id: Optional[str],
    tone: str = "professional",
    platform: str = "linkedin",
    language: str = "fr",
) -> dict[str, Any]:
    """
    Celery task — generate a social media post.

    Args:
        lead_id:  Lead UUID string or None.
        tone:     Writing tone.
        platform: Target platform.
        language: Output language.

    Returns:
        Dict with generated text and metadata.
    """
    from microservices.bs_ai_text.service import generate_post

    logger.info("[bs_ai_text] Task generate_post | lead={} platform={}", lead_id, platform)
    try:
        lead_uuid = uuid.UUID(lead_id) if lead_id else None
        return _run_async(generate_post(lead_uuid, tone, platform, language))
    except Exception as exc:
        logger.error("[bs_ai_text] Task failed | error={}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="bs_ai_text.generate_email",
    max_retries=3,
    default_retry_delay=30,
)
def task_generate_email(
    self: Any,
    lead_id: Optional[str],
    campaign_id: str,
    language: str = "fr",
) -> dict[str, Any]:
    """
    Celery task — generate email content for a lead.

    Args:
        lead_id:     Lead UUID string.
        campaign_id: Campaign UUID string.
        language:    Output language.

    Returns:
        Dict with subject + body text.
    """
    from microservices.bs_ai_text.service import generate_email_content

    logger.info("[bs_ai_text] Task generate_email | lead={} campaign={}", lead_id, campaign_id)
    try:
        lead_uuid = uuid.UUID(lead_id) if lead_id else None
        campaign_uuid = uuid.UUID(campaign_id)
        return _run_async(generate_email_content(lead_uuid, campaign_uuid, language))
    except Exception as exc:
        logger.error("[bs_ai_text] Task email failed | error={}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="bs_ai_text.generate_newsletter",
    max_retries=3,
    default_retry_delay=60,
)
def task_generate_newsletter(
    self: Any,
    campaign_id: str,
    language: str = "fr",
) -> dict[str, Any]:
    """
    Celery task — generate a full newsletter for a campaign.

    Args:
        campaign_id: Campaign UUID string.
        language:    Output language.

    Returns:
        Dict with newsletter body text.
    """
    from microservices.bs_ai_text.service import generate_newsletter

    logger.info("[bs_ai_text] Task generate_newsletter | campaign={}", campaign_id)
    try:
        campaign_uuid = uuid.UUID(campaign_id)
        return _run_async(generate_newsletter(campaign_uuid, language))
    except Exception as exc:
        raise self.retry(exc=exc)


if __name__ == "__main__":
    print("[bs_ai_text] Worker module loaded — ready for Celery.")
