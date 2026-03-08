#!/usr/bin/env python3
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/check_health.py
# DESCRIPTION  : One-shot health check for CI / deploy gates
# AUTHOR       : BRANDSCALE Dev Team
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import asyncio
import os
import sys

import httpx

SERVICES: dict[str, str] = {
    "Backend":  os.getenv("BACKEND_URL",  "http://localhost:8000/api/v1/health"),
    "AI Text":  os.getenv("AI_TEXT_URL",  "http://localhost:8001/bs-ai-text/health"),
    "AI Image": os.getenv("AI_IMAGE_URL", "http://localhost:8002/bs-ai-image/health"),
    "AI Video": os.getenv("AI_VIDEO_URL", "http://localhost:8003/bs-ai-video/health"),
    "Email":    os.getenv("EMAIL_URL",    "http://localhost:8004/bs-email/health"),
    "Scoring":  os.getenv("SCORING_URL",  "http://localhost:8005/bs-scoring/health"),
}

REQUIRED_SERVICES = {"Backend"}  # Fail CI if these are down


async def check_all() -> bool:
    """
    Check all service endpoints and print a status report.

    Returns:
        True if all required services are healthy, False otherwise.
    """
    all_ok = True
    async with httpx.AsyncClient() as client:
        for name, url in SERVICES.items():
            try:
                response = await client.get(url, timeout=5.0)
                ok = response.status_code == 200
            except Exception:
                ok = False
            icon = "✅" if ok else "❌"
            required_marker = " (REQUIRED)" if name in REQUIRED_SERVICES else ""
            print(f"  {icon}  {name:<14} {url}{required_marker}")
            if not ok and name in REQUIRED_SERVICES:
                all_ok = False
    return all_ok


def main() -> None:
    """Entry point — exits with code 1 if any required service is down."""
    print("\n[BRANDSCALE] Health Check\n")
    result = asyncio.run(check_all())
    print()
    if result:
        print("[BRANDSCALE] ✅ All required services are healthy.")
        sys.exit(0)
    else:
        print("[BRANDSCALE] ❌ One or more required services are unhealthy.")
        sys.exit(1)


if __name__ == "__main__":
    main()
