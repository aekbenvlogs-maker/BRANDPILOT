# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/worker.py
# DESCRIPTION  : Celery tasks for content formatting
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import asyncio
from dataclasses import asdict

from celery import Celery
from loguru import logger

from configs.settings import get_settings
from microservices.bs_content_formatter.service import format_content_for_platform

settings = get_settings()

celery_app = Celery(
    "bs_content_formatter",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    name="bs_content_formatter.format_content",
    max_retries=3,
    default_retry_delay=30,
)
def format_content_task(
    self,
    content: str,
    source_platform: str,
    target_platform: str,
    niche: str = "general",
    hashtag_count: int = 30,
    brand_data: dict | None = None,
) -> dict:
    try:
        result = _run(
            format_content_for_platform(
                content=content,
                source_platform=source_platform,
                target_platform=target_platform,
                niche=niche,
                hashtag_count=hashtag_count,
                brand_data=brand_data,
            )
        )
        return asdict(result)
    except Exception as exc:
        logger.error("format_content_task failed: {}", exc)
        raise self.retry(exc=exc)
