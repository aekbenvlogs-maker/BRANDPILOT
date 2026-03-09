# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_image/worker.py
# DESCRIPTION  : Celery task wrappers for AI image generation
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
    "bs_ai_image",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,
    task_acks_late=True,
    task_max_retries=3,
)


@celery_app.task(
    bind=True, name="bs_ai_image.generate", max_retries=3, default_retry_delay=60
)
def task_generate_image(
    self: Any,
    prompt: str,
    style: str = "photorealistic",
    size: str = "1024x1024",
) -> str:
    """
    Celery task — generate and upload a marketing image.

    Args:
        prompt: Generation prompt.
        style:  Visual style.
        size:   Output dimensions.

    Returns:
        S3 URL of the generated image.
    """
    from microservices.bs_ai_image.service import generate_marketing_image

    logger.info("[bs_ai_image] Task generate | style={} size={}", style, size)
    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(generate_marketing_image(prompt, style, size))
        loop.close()
        return result
    except Exception as exc:
        logger.error("[bs_ai_image] Task failed | error={}", str(exc))
        raise self.retry(exc=exc)
