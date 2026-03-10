# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/api.py
# DESCRIPTION  : FastAPI router for content formatting endpoints
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from microservices.bs_content_formatter.worker import format_content_task, celery_app

router = APIRouter(prefix="/content-formatter", tags=["content-formatter"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FormatContentRequest(BaseModel):
    content: str
    source_platform: str
    target_platform: str
    niche: str = "general"
    hashtag_count: int = 30
    brand_data: dict | None = None


class TaskResponse(BaseModel):
    task_id: str
    status: str = "queued"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/format", status_code=202, response_model=TaskResponse)
async def format_content(body: FormatContentRequest) -> TaskResponse:
    """Trigger async content formatting for a target platform."""
    task = format_content_task.delay(
        content=body.content,
        source_platform=body.source_platform,
        target_platform=body.target_platform,
        niche=body.niche,
        hashtag_count=body.hashtag_count,
        brand_data=body.brand_data,
    )
    return TaskResponse(task_id=task.id)


@router.get("/tasks/{task_id}")
async def get_task_result(task_id: str) -> dict:
    """Poll the result of a previously submitted formatting task."""
    from celery.result import AsyncResult
    result = AsyncResult(task_id, app=celery_app)
    if result.state == "PENDING":
        return {"status": "pending"}
    if result.state == "FAILURE":
        raise HTTPException(status_code=500, detail=str(result.result))
    return {"status": result.state, "result": result.result}
