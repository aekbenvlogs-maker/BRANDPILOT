# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_video/worker.py
# DESCRIPTION  : Celery task wrappers for AI video generation
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
    "bs_ai_video",
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
    bind=True, name="bs_ai_video.generate_script", max_retries=3, default_retry_delay=30
)
def task_generate_video_script(
    self: Any,
    lead_data: dict[str, Any],
    campaign_data: dict[str, Any],
) -> str:
    """
    Celery task — generate a video script for a lead/campaign pair.

    Args:
        lead_data:     Lead context dict.
        campaign_data: Campaign metadata dict.

    Returns:
        Generated video script string.
    """
    from microservices.bs_ai_video.service import generate_video_script

    logger.info(
        "[bs_ai_video] Task generate_script | campaign={}", campaign_data.get("name")
    )
    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            generate_video_script(lead_data, campaign_data)
        )
        loop.close()
        return result
    except Exception as exc:
        logger.error("[bs_ai_video] Script task failed | {}", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True, name="bs_ai_video.render", max_retries=3, default_retry_delay=60
)
def task_render_video(
    self: Any,
    script: str,
    template: str = "default",
) -> str:
    """
    Celery task — render and upload a video.

    Args:
        script:   Video script text.
        template: Video template identifier.

    Returns:
        S3 URL of the rendered video.
    """
    from microservices.bs_ai_video.service import render_video

    logger.info("[bs_ai_video] Task render_video | template={}", template)
    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(render_video(script, template))
        loop.close()
        return result
    except Exception as exc:
        logger.error("[bs_ai_video] Render task failed | {}", str(exc))
        raise self.retry(exc=exc)
