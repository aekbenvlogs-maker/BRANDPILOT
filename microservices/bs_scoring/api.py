# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_scoring/api.py
# DESCRIPTION  : FastAPI sub-router for lead scoring endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from microservices.bs_scoring.service import classify_tier, explain_score, rank_leads, score_lead

router = APIRouter(prefix="/bs-scoring", tags=["bs-scoring"])


class ScoreRequest(BaseModel):
    lead: dict[str, Any] = Field(..., description="Lead dict with scoring fields")


class ScoreResponse(BaseModel):
    lead_id: str | None
    score: int
    tier: str


class RankRequest(BaseModel):
    leads: list[dict[str, Any]] = Field(..., description="List of lead dicts")


class ExplainResponse(BaseModel):
    lead_id: str | None
    factors: dict[str, int]
    weights: dict[str, float]
    weighted_contribution: dict[str, float]
    total_score: int
    tier: str
    improvement_hints: list[str]


@router.get("/health", summary="Service health check")
async def health() -> dict[str, str]:
    """Return service liveness status."""
    return {"service": "bs-scoring", "status": "ok"}


@router.post(
    "/score",
    response_model=ScoreResponse,
    summary="Score a single lead",
)
async def post_score_lead(payload: ScoreRequest) -> ScoreResponse:
    """
    Compute a quality score for a single lead.

    Args:
        payload: Lead dict.

    Returns:
        Lead ID, score, and tier.
    """
    logger.info("[bs_scoring] /score | lead_id={}", payload.lead.get("id"))
    try:
        s = score_lead(payload.lead)
        tier = classify_tier(s)
        return ScoreResponse(lead_id=str(payload.lead.get("id", "")), score=s, tier=tier)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/rank",
    summary="Score and rank a list of leads",
)
async def post_rank_leads(payload: RankRequest) -> list[dict[str, Any]]:
    """
    Score and sort a list of leads by descending quality.

    Args:
        payload: List of lead dicts.

    Returns:
        Sorted list with injected score field.
    """
    logger.info("[bs_scoring] /rank | count={}", len(payload.leads))
    try:
        return rank_leads(payload.leads)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/explain",
    response_model=ExplainResponse,
    summary="Explain lead score breakdown",
)
async def post_explain_score(payload: ScoreRequest) -> ExplainResponse:
    """
    Return detailed factor breakdown for a lead's score.

    Args:
        payload: Lead dict.

    Returns:
        Score explanation with factors, tier, and improvement hints.
    """
    logger.info("[bs_scoring] /explain | lead_id={}", payload.lead.get("id"))
    try:
        result = explain_score(payload.lead)
        return ExplainResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
