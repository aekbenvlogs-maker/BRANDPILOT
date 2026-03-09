# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_email/worker.py
# DESCRIPTION  : Celery task wrappers for email sending
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import asyncio
from typing import Any

from celery import Celery
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "bs_email",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,
    task_acks_late=True,
)


@celery_app.task(bind=True, name="bs_email.send", max_retries=3, default_retry_delay=60)
def task_send_email(self: Any, email_id: str) -> bool:
    """
    Celery task — send a single email by its database ID.

    Args:
        email_id: Email record UUID.

    Returns:
        True on success, False on failure.
    """
    from microservices.bs_email.service import send_email

    logger.info("[bs_email] Task send | email_id={}", email_id)
    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(send_email(email_id))
        loop.close()
        return result
    except Exception as exc:
        logger.error("[bs_email] Send task failed | {}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True, name="bs_email.create_sequence", max_retries=3, default_retry_delay=30
)
def task_create_sequence(
    self: Any,
    campaign_data: dict[str, Any],
    leads: list[dict[str, Any]],
    template_html: str,
) -> list[str]:
    """
    Celery task — create an email sequence for a campaign.

    Args:
        campaign_data: Campaign metadata.
        leads:         List of lead dicts.
        template_html: HTML template.

    Returns:
        List of created Email IDs.
    """
    from microservices.bs_email.service import create_sequence

    logger.info(
        "[bs_email] Task create_sequence | campaign={}", campaign_data.get("name")
    )
    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            create_sequence(campaign_data, leads, template_html)
        )
        loop.close()
        return result
    except Exception as exc:
        logger.error("[bs_email] Sequence task failed | {}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(name="bs_email.unsubscribe")
def task_unsubscribe(lead_id: str) -> None:
    """
    Celery task — RGPD unsubscribe a lead.

    Args:
        lead_id: Lead UUID to unsubscribe.
    """
    from microservices.bs_email.service import unsubscribe

    logger.info("[bs_email] Task unsubscribe | lead_id={}", lead_id)
    loop = asyncio.new_event_loop()
    loop.run_until_complete(unsubscribe(lead_id))
    loop.close()
