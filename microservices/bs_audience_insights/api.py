# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/api.py
# DESCRIPTION  : FastAPI router for audience insights endpoints
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from microservices.bs_audience_insights.worker import analyze_account_task, analyze_influencer_task

router = APIRouter(prefix="/audience-insights", tags=["audience-insights"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AnalyzeAccountRequest(BaseModel):
    social_account_id: str
    niche: str = "general"
    content_type: str = "post"


class AnalyzeInfluencerRequest(BaseModel):
    username: str
    platform: str
    followers: int
    avg_likes: float
    avg_comments: float
    avg_views: float = 0.0
    niche: str = "general"


class TaskResponse(BaseModel):
    task_id: str
    status: str = "queued"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/accounts/analyze", status_code=202, response_model=TaskResponse)
async def analyze_account(body: AnalyzeAccountRequest) -> TaskResponse:
    """Trigger async audience analysis for a connected social account."""
    task = analyze_account_task.delay(
        social_account_id=body.social_account_id,
        niche=body.niche,
        content_type=body.content_type,
    )
    return TaskResponse(task_id=task.id)


@router.post("/influencers/analyze", status_code=202, response_model=TaskResponse)
async def analyze_influencer_endpoint(body: AnalyzeInfluencerRequest) -> TaskResponse:
    """Trigger async analysis for a third-party influencer."""
    task = analyze_influencer_task.delay(
        username=body.username,
        platform=body.platform,
        followers=body.followers,
        avg_likes=body.avg_likes,
        avg_comments=body.avg_comments,
        avg_views=body.avg_views,
        niche=body.niche,
    )
    return TaskResponse(task_id=task.id)


@router.get("/tasks/{task_id}")
async def get_task_result(task_id: str) -> dict:
    """Poll the result of a previously submitted analysis task."""
    from celery.result import AsyncResult
    from microservices.bs_audience_insights.worker import celery_app

    result = AsyncResult(task_id, app=celery_app)
    if result.state == "PENDING":
        return {"status": "pending"}
    if result.state == "FAILURE":
        raise HTTPException(status_code=500, detail=str(result.result))
    return {"status": result.state, "result": result.result}
