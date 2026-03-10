# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/api.py
# DESCRIPTION  : FastAPI router for brand analysis endpoints
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/brand-analysis", tags=["brand-analysis"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    project_id: str
    source_url: str


class TaskResponse(BaseModel):
    task_id: str
    status: str = "queued"


class BrandAnalysisResponse(BaseModel):
    id: str
    project_id: str
    source_url: str | None
    detected_tone: str | None
    detected_niche: str | None
    primary_colors: list[str]
    keywords: list[str]
    target_audience: str | None
    consistency_score: int | None
    competitors: list[dict[str, object]]
    created_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_brand_analysis(req: AnalyzeRequest) -> TaskResponse:
    """
    Launch a brand analysis pipeline asynchronously.

    POST /api/v1/brand-analysis/analyze
    Body: {"project_id": "...", "source_url": "https://..."}
    Response 202: {"task_id": "..."}
    """
    from microservices.bs_brand_analyzer.worker import analyze_brand_task

    task = analyze_brand_task.apply_async(
        args=[req.project_id, req.source_url, "system"],
    )
    return TaskResponse(task_id=task.id)


@router.get("/{project_id}/latest", response_model=BrandAnalysisResponse)
async def get_latest_analysis(project_id: str) -> BrandAnalysisResponse:
    """
    Return the most recent brand analysis for a project.

    GET /api/v1/brand-analysis/{project_id}/latest
    """
    from database.connection import db_session
    from sqlalchemy import text

    async with db_session() as session:
        row = (
            await session.execute(
                text(
                    "SELECT id, project_id, source_url, detected_tone, detected_niche, "
                    " primary_colors, keywords, target_audience, consistency_score, "
                    " competitors, created_at "
                    "FROM brand_analyses WHERE project_id = :pid "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"pid": project_id},
            )
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No brand analysis found for this project.",
        )

    return BrandAnalysisResponse(
        id=str(row.id),
        project_id=str(row.project_id),
        source_url=row.source_url,
        detected_tone=row.detected_tone,
        detected_niche=row.detected_niche,
        primary_colors=row.primary_colors or [],
        keywords=row.keywords or [],
        target_audience=row.target_audience,
        consistency_score=row.consistency_score,
        competitors=row.competitors or [],
        created_at=str(row.created_at),
    )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"service": "bs_brand_analyzer", "status": "healthy"}
