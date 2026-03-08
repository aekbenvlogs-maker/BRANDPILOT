# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/workflows.py
# DESCRIPTION  : FastAPI routes for workflow orchestration
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.controllers.workflow_controller import (
    handle_get_workflow_status,
    handle_run_workflow,
)
from backend.middleware.auth import get_current_user_id
from database.connection import get_db_session

router = APIRouter()


@router.post("/run")
async def run_workflow(
    campaign_id: uuid.UUID = Body(..., embed=True),
    job_type: str = Body(default="l2c_pipeline", embed=True),
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    """
    Trigger a workflow pipeline for a campaign.

    - **l2c_pipeline**: Full Lead-to-Content pipeline
    """
    return await handle_run_workflow(db, campaign_id, job_type)


@router.get("/status/{job_id}")
async def get_workflow_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return current status and step for a workflow job."""
    return await handle_get_workflow_status(db, job_id)
