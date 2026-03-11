# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/health.py
# DESCRIPTION  : Health check endpoint — all microservices + DB + Redis status
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import asyncio
from typing import Any

from database.connection import get_db_session
from fastapi import APIRouter, Depends
import httpx
from loguru import logger
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from configs.settings import get_settings

router = APIRouter()
settings = get_settings()

# Microservice health endpoints — use Docker service names (not localhost)
_MICROSERVICES: dict[str, str] = {
    "bs_ai_text":      "http://bs_ai_text:8001/health",
    "bs_ai_image":     "http://bs_ai_image:8002/health",
    "bs_ai_video":     "http://bs_ai_video:8003/health",
    "bs_email":        "http://bs_email:8004/health",
    "bs_scoring":      "http://bs_scoring:8005/health",
    "campaign_agent":  "http://campaign_agent:8006/health",
}


async def _check_http_service(name: str, url: str) -> dict[str, str]:
    """
    Check a microservice HTTP health endpoint.

    Returns:
        Dict with name, status (healthy/degraded/down), and optional message.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return {"name": name, "status": "healthy"}
            return {"name": name, "status": "degraded", "code": str(resp.status_code)}
    except Exception as exc:
        logger.warning(
            "[BRANDSCALE] Health check failed | service={} error={}", name, str(exc)
        )
        return {"name": name, "status": "down", "error": str(exc)}


async def _check_database(db: AsyncSession) -> dict[str, str]:
    """Check database connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        return {"name": "database", "status": "healthy"}
    except Exception as exc:
        return {"name": "database", "status": "down", "error": str(exc)}


async def _check_redis() -> dict[str, str]:
    """Check Redis connectivity."""
    try:
        client = aioredis.from_url(settings.redis_url, socket_timeout=2)
        await client.ping()
        await client.aclose()  # type: ignore[attr-defined]
        return {"name": "redis", "status": "healthy"}
    except Exception as exc:
        return {"name": "redis", "status": "down", "error": str(exc)}


@router.get("", status_code=200)
async def health_check(
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Aggregate health check for all BRANDSCALE services.

    Returns JSON with:
    - database status
    - redis status
    - each microservice status (healthy/degraded/down)
    - overall status
    """
    # Run all checks concurrently
    tasks = [
        _check_database(db),
        _check_redis(),
        *[_check_http_service(name, url) for name, url in _MICROSERVICES.items()],
    ]

    results: list[dict[str, str]] = await asyncio.gather(*tasks)

    # Determine overall status
    statuses = {r["status"] for r in results}
    if "down" in statuses:
        overall = "degraded"
    elif "degraded" in statuses:
        overall = "degraded"
    else:
        overall = "healthy"

    return {
        "service": "BRANDSCALE API",
        "version": settings.app_version,
        "overall": overall,
        "components": results,
    }
