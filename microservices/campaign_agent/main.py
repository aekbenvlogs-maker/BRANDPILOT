# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/campaign_agent/main.py
# DESCRIPTION  : FastAPI entrypoint for campaign_agent microservice (port 8006)
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-11
# ============================================================
"""
Campaign Agent microservice entrypoint.

Exposes the FastAPI app from campaign_agent/api.py as a standalone
uvicorn process on port 8006.

Run:
    uvicorn microservices.campaign_agent.main:app --host 0.0.0.0 --port 8006
"""

from __future__ import annotations

import uvicorn

from microservices.campaign_agent.api import app  # noqa: F401 — re-exported

if __name__ == "__main__":
    uvicorn.run(
        "microservices.campaign_agent.main:app",
        host="0.0.0.0",
        port=8006,
        reload=False,
    )
