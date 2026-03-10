# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/campaign_agent/api.py
# DESCRIPTION  : FastAPI micro-app for the Campaign Agent microservice.
#                Can be run standalone or mounted into the main app.
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================
"""
Standalone FastAPI app for the Campaign Agent microservice.

Provides:
  - /health      — liveness probe
  - /ready       — readiness probe (checks Redis + Celery connectivity)
  - /worker/stats — Celery worker stats (internal monitoring)

Mount in main.py (optional):
    app.mount("/agent", campaign_agent_app)

Or run standalone:
    uvicorn microservices.campaign_agent.api:app --port 8001
"""

from __future__ import annotations

import time
from typing import Any

import redis.asyncio as aioredis
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from loguru import logger

from configs.settings import get_settings
from microservices.campaign_agent.worker import celery_app

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="BRANDPILOT — Campaign Agent",
    description=(
        "Internal microservice: 10-step AI campaign generation pipeline. "
        "Powered by GPT-4, Celery chords, and Redis pub/sub."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------


@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
    status_code=status.HTTP_200_OK,
)
async def health() -> JSONResponse:
    """Liveness probe — always returns 200 if the process is alive."""
    return JSONResponse({"status": "alive", "service": "campaign_agent"})


@app.get(
    "/ready",
    tags=["Health"],
    summary="Readiness probe — checks Redis and Celery",
    status_code=status.HTTP_200_OK,
)
async def ready() -> JSONResponse:
    """Readiness probe.

    Checks:
    - Redis connectivity (ping).
    - Celery worker availability (inspect ping with 2 s timeout).

    Returns 200 if all checks pass, 503 otherwise.
    """
    settings = get_settings()
    checks: dict[str, Any] = {}
    all_ok = True

    # --- Redis ---
    t0 = time.monotonic()
    try:
        async with aioredis.from_url(settings.redis_url) as redis:
            pong = await redis.ping()
        checks["redis"] = {
            "status": "ok" if pong else "error",
            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
        }
        if not pong:
            all_ok = False
    except Exception as exc:
        checks["redis"] = {"status": "error", "detail": str(exc)}
        all_ok = False
        logger.warning("[campaign_agent/ready] Redis check failed | {}", exc)

    # --- Celery ---
    t1 = time.monotonic()
    try:
        inspect = celery_app.control.inspect(timeout=2.0)
        active = inspect.active()
        worker_count = len(active) if active else 0
        checks["celery"] = {
            "status": "ok" if worker_count > 0 else "no_workers",
            "active_workers": worker_count,
            "latency_ms": round((time.monotonic() - t1) * 1000, 1),
        }
        if worker_count == 0:
            # Warn but don't mark as not-ready — workers may start later.
            logger.warning("[campaign_agent/ready] No active Celery workers.")
    except Exception as exc:
        checks["celery"] = {"status": "error", "detail": str(exc)}
        logger.warning("[campaign_agent/ready] Celery inspect failed | {}", exc)

    http_status = status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        {
            "status": "ready" if all_ok else "not_ready",
            "service": "campaign_agent",
            "checks": checks,
        },
        status_code=http_status,
    )


# ---------------------------------------------------------------------------
# Worker stats (internal — not exposed to the public internet)
# ---------------------------------------------------------------------------


@app.get(
    "/worker/stats",
    tags=["Internal"],
    summary="Celery worker statistics",
    status_code=status.HTTP_200_OK,
)
async def worker_stats() -> JSONResponse:
    """Return Celery worker stats for internal monitoring/dashboards.

    Queries the Celery control plane for active, reserved, and scheduled tasks.
    Use a 3 s timeout to avoid blocking health checks in CI.

    Returns:
        JSON with active, reserved, and scheduled task counts per worker.
    """
    try:
        inspect = celery_app.control.inspect(timeout=3.0)
        active = inspect.active() or {}
        reserved = inspect.reserved() or {}
        scheduled = inspect.scheduled() or {}

        stats: dict[str, Any] = {}
        for worker in set(list(active) + list(reserved) + list(scheduled)):
            stats[worker] = {
                "active": len(active.get(worker, [])),
                "reserved": len(reserved.get(worker, [])),
                "scheduled": len(scheduled.get(worker, [])),
            }

        return JSONResponse(
            {
                "service": "campaign_agent",
                "workers": stats,
                "total_workers": len(stats),
            }
        )
    except Exception as exc:
        logger.error("[campaign_agent/worker_stats] Error | {}", exc)
        return JSONResponse(
            {"status": "error", "detail": str(exc)},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


# ---------------------------------------------------------------------------
# Entry point for standalone run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "microservices.campaign_agent.api:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info",
    )
