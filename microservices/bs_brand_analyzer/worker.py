# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/worker.py
# DESCRIPTION  : Celery task wrapper for brand analysis pipeline
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import asyncio
from typing import Any

from celery import Celery
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "bs_brand_analyzer",
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


def _run(coro: Any) -> Any:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    name="bs_brand_analyzer.analyze",
    max_retries=2,
    default_retry_delay=30,
)
def analyze_brand_task(
    self: Any,
    project_id: str,
    source_url: str,
    user_id: str,
) -> dict[str, object]:
    """
    Celery task — run the full brand analysis pipeline.

    Args:
        project_id: UUID string of the project.
        source_url: URL of the brand website.
        user_id:    UUID string of the requesting user (for audit).

    Returns:
        Serialised BrandAnalysis dict.
    """
    from microservices.bs_brand_analyzer.service import analyze_brand

    logger.info(
        "[bs_brand_analyzer] Task started project_id={} user_id={} url={}",
        project_id,
        user_id,
        source_url,
    )
    try:
        result = _run(analyze_brand(project_id, source_url))
        logger.info("[bs_brand_analyzer] Task complete id={}", result.id)
        return {
            "id": result.id,
            "project_id": result.project_id,
            "detected_tone": result.detected_tone,
            "consistency_score": result.consistency_score,
            "status": "completed",
        }
    except Exception as exc:
        logger.error("[bs_brand_analyzer] Task failed: {}", exc)
        raise self.retry(exc=exc)
