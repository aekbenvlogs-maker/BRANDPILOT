# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/controllers/workflow_controller.py
# DESCRIPTION  : Request orchestration for workflow endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Any
import uuid

from database.models_orm import WorkflowJob
from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def handle_run_workflow(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    job_type: str = "l2c_pipeline",
) -> dict[str, Any]:
    """
    Trigger a workflow pipeline job via Celery.

    Args:
        db:          Async database session.
        campaign_id: Target campaign UUID.
        job_type:    Workflow type identifier.

    Returns:
        Dict with job_id and initial status.
    """
    try:
        from microservices.workflow import run_l2c_pipeline

        task = run_l2c_pipeline.delay(str(campaign_id))
        task_id = task.id
    except Exception as exc:
        logger.error("[BRANDSCALE] Workflow trigger failed | error={}", str(exc))
        task_id = str(uuid.uuid4())  # fallback job ID

    # Create workflow job record
    job = WorkflowJob(
        campaign_id=campaign_id,
        job_type=job_type,
        current_step="initializing",
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    logger.info(
        "[BRANDSCALE] Workflow started | job_id={} campaign={}", job.id, campaign_id
    )

    return {
        "job_id": str(job.id),
        "celery_task_id": task_id,
        "status": job.status.value,
        "message": f"Workflow '{job_type}' initiated.",
    }


async def handle_get_workflow_status(
    db: AsyncSession,
    job_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Return the current status of a workflow job.

    Args:
        db:     Async database session.
        job_id: Workflow job UUID.

    Returns:
        Dict with job status details.
    """
    result = await db.execute(select(WorkflowJob).where(WorkflowJob.id == job_id))
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow job {job_id} not found.",
        )

    return {
        "job_id": str(job.id),
        "job_type": job.job_type,
        "status": job.status.value,
        "current_step": job.current_step,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error_msg": job.error_msg,
    }
