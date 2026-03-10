# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/worker.py
# DESCRIPTION  : Celery tasks for social publishing + metrics
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import asyncio
from dataclasses import asdict

from celery import Celery
from loguru import logger

from configs.settings import get_settings
from microservices.bs_social_publisher.service import publish_post
from microservices.bs_social_publisher.analytics_collector import collect_post_metrics
from microservices.bs_social_publisher.oauth_manager import oauth_manager

settings = get_settings()

celery_app = Celery(
    "bs_social_publisher",
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
    name="bs_social_publisher.publish_post",
    max_retries=2,
    default_retry_delay=60,
)
def publish_post_task(
    self,
    post_id: str,
    social_account_id: str,
    video_bytes: bytes | None = None,
    image_bytes: bytes | None = None,
) -> dict:
    """
    Publish a post to a social platform.

    Security: service.publish_post() enforces the triple-check:
        1. post.status == "approved"
        2. campaign.status in ("approved", "active")
        3. access_token non-empty
    """
    try:
        result = _run(
            publish_post(
                post_id=post_id,
                social_account_id=social_account_id,
                video_bytes=video_bytes,
                image_bytes=image_bytes,
            )
        )
        # Schedule metrics collection 24h after successful publication
        if result.success:
            collect_metrics_task.apply_async(
                kwargs={
                    "post_id":          post_id,
                    "platform":         result.platform,
                    "social_account_id": social_account_id,
                    "platform_post_id": result.platform_post_id,
                },
                countdown=86400,  # 24 hours
            )
        return asdict(result)
    except Exception as exc:
        logger.error("publish_post_task failed for post {}: type={}", post_id, type(exc).__name__)
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="bs_social_publisher.collect_metrics",
    max_retries=3,
    default_retry_delay=3600,
)
def collect_metrics_task(
    self,
    post_id: str,
    platform: str,
    social_account_id: str,
    platform_post_id: str,
) -> dict:
    """Collect engagement metrics for a published post."""
    try:
        access_token = _run(oauth_manager.get_valid_token(social_account_id))
        metrics = _run(
            collect_post_metrics(
                post_id=post_id,
                platform=platform,
                access_token=access_token,
                platform_post_id=platform_post_id,
            )
        )
        return asdict(metrics)
    except Exception as exc:
        logger.error("collect_metrics_task failed for post {}: type={}", post_id, type(exc).__name__)
        raise self.retry(exc=exc)
