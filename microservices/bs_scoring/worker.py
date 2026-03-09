# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_scoring/worker.py
# DESCRIPTION  : Celery task wrappers for lead scoring
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Any

from celery import Celery
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "bs_scoring",
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


@celery_app.task(
    bind=True, name="bs_scoring.score_lead", max_retries=3, default_retry_delay=10
)
def task_score_lead(self: Any, lead: dict[str, Any]) -> dict[str, Any]:
    """
    Celery task — score a single lead dict.

    Args:
        lead: Lead data dict.

    Returns:
        Dict with lead_id, score, and tier.
    """
    from microservices.bs_scoring.service import classify_tier, score_lead

    logger.info("[bs_scoring] Task score_lead | lead_id={}", lead.get("id"))
    try:
        score = score_lead(lead)
        tier = classify_tier(score)
        return {"lead_id": lead.get("id"), "score": score, "tier": tier}
    except Exception as exc:
        logger.error("[bs_scoring] score_lead task failed | {}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True, name="bs_scoring.rank_leads", max_retries=3, default_retry_delay=10
)
def task_rank_leads(self: Any, leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Celery task — score and rank a list of leads.

    Args:
        leads: List of lead dicts.

    Returns:
        Sorted list with score field.
    """
    from microservices.bs_scoring.service import rank_leads

    logger.info("[bs_scoring] Task rank_leads | count={}", len(leads))
    try:
        return rank_leads(leads)
    except Exception as exc:
        logger.error("[bs_scoring] rank_leads task failed | {}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(name="bs_scoring.explain_score")
def task_explain_score(lead: dict[str, Any]) -> dict[str, Any]:
    """
    Celery task — return factor breakdown for a lead score.

    Args:
        lead: Lead data dict.

    Returns:
        Explanation dict with factor scores, tier, hints.
    """
    from microservices.bs_scoring.service import explain_score

    logger.info("[bs_scoring] Task explain_score | lead_id={}", lead.get("id"))
    return explain_score(lead)
