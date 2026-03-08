#!/usr/bin/env python3
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/monitor_services.py
# DESCRIPTION  : Real-time terminal monitor for all microservices
# AUTHOR       : BRANDSCALE Dev Team
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import asyncio
import os
from datetime import datetime

import httpx
from loguru import logger

SERVICES: dict[str, str] = {
    "Backend":    os.getenv("BACKEND_URL",   "http://localhost:8000/api/v1/health"),
    "AI Text":    os.getenv("AI_TEXT_URL",   "http://localhost:8001/bs-ai-text/health"),
    "AI Image":   os.getenv("AI_IMAGE_URL",  "http://localhost:8002/bs-ai-image/health"),
    "AI Video":   os.getenv("AI_VIDEO_URL",  "http://localhost:8003/bs-ai-video/health"),
    "Email":      os.getenv("EMAIL_URL",     "http://localhost:8004/bs-email/health"),
    "Scoring":    os.getenv("SCORING_URL",   "http://localhost:8005/bs-scoring/health"),
}

REFRESH_SECONDS = int(os.getenv("MONITOR_REFRESH", "10"))


async def check_service(client: httpx.AsyncClient, name: str, url: str) -> tuple[str, str, float]:
    """
    Ping a service health endpoint and return status.

    Args:
        client: Shared httpx async client.
        name:   Human-readable service name.
        url:    Health check URL.

    Returns:
        Tuple of (name, status_string, response_time_ms).
    """
    start = asyncio.get_event_loop().time()
    try:
        response = await client.get(url, timeout=3.0)
        elapsed = (asyncio.get_event_loop().time() - start) * 1000
        status = "✅ OK" if response.status_code == 200 else f"⚠️  HTTP {response.status_code}"
    except httpx.ConnectError:
        elapsed = 0.0
        status = "❌ UNREACHABLE"
    except httpx.TimeoutException:
        elapsed = 3000.0
        status = "⏱  TIMEOUT"
    except Exception as exc:
        elapsed = 0.0
        status = f"💥 ERROR: {exc}"
    return name, status, elapsed


async def monitor_loop() -> None:
    """Run monitoring loop, printing a table every REFRESH_SECONDS."""
    async with httpx.AsyncClient() as client:
        while True:
            now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            results = await asyncio.gather(
                *(check_service(client, name, url) for name, url in SERVICES.items())
            )
            print(f"\n{'=' * 52}")
            print(f"  BRANDSCALE Service Monitor — {now}")
            print(f"{'=' * 52}")
            for name, status, ms in results:
                label = f"{name:<12}"
                timing = f"{ms:>7.1f} ms" if ms else " " * 10
                print(f"  {label}  {status:<20}  {timing}")
            print(f"{'─' * 52}")
            print(f"  Next refresh in {REFRESH_SECONDS}s  |  Ctrl+C to stop")
            await asyncio.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    logger.info("[BRANDSCALE] Service monitor started")
    try:
        asyncio.run(monitor_loop())
    except KeyboardInterrupt:
        print("\n[BRANDSCALE] Monitor stopped.")
