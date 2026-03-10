# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/worker.py
# DESCRIPTION  : Celery tasks for audience insights
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import asyncio

from celery import Celery
from loguru import logger

from configs.settings import get_settings
from microservices.bs_audience_insights.service import analyze_social_account, analyze_influencer

settings = get_settings()

celery_app = Celery(
    "bs_audience_insights",
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
    name="bs_audience_insights.analyze_account",
    max_retries=3,
    default_retry_delay=60,
)
def analyze_account_task(
    self,
    social_account_id: str,
    niche: str = "general",
    content_type: str = "post",
) -> dict:
    try:
        result = _run(
            analyze_social_account(
                social_account_id=social_account_id,
                niche=niche,
                content_type=content_type,
            )
        )
        from dataclasses import asdict
        return asdict(result)
    except Exception as exc:
        logger.error("analyze_account_task failed: {}", exc)
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="bs_audience_insights.analyze_influencer",
    max_retries=2,
    default_retry_delay=30,
)
def analyze_influencer_task(
    self,
    username: str,
    platform: str,
    followers: int,
    avg_likes: float,
    avg_comments: float,
    avg_views: float = 0.0,
    niche: str = "general",
) -> dict:
    try:
        result = _run(
            analyze_influencer(
                username=username,
                platform=platform,  # type: ignore[arg-type]
                followers=followers,
                avg_likes=avg_likes,
                avg_comments=avg_comments,
                avg_views=avg_views,
                niche=niche,
            )
        )
        from dataclasses import asdict
        return asdict(result)
    except Exception as exc:
        logger.error("analyze_influencer_task failed: {}", exc)
        raise self.retry(exc=exc)
