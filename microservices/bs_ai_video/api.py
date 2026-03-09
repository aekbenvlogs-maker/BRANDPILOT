# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_video/api.py
# DESCRIPTION  : FastAPI sub-router for AI video generation
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

from microservices.bs_ai_video.service import generate_video_script, render_video

router = APIRouter(prefix="/bs-ai-video", tags=["bs-ai-video"])


class ScriptRequest(BaseModel):
    lead_data: dict[str, Any] = Field(..., description="Lead context")
    campaign_data: dict[str, Any] = Field(..., description="Campaign metadata")


class ScriptResponse(BaseModel):
    script: str


class RenderRequest(BaseModel):
    script: str = Field(..., min_length=10, description="Video script text")
    template: str = Field("default", description="Video template identifier")


class RenderResponse(BaseModel):
    video_url: str
    template: str


@router.get("/health", summary="Service health check")
async def health() -> dict[str, str]:
    """Return service liveness status."""
    return {"service": "bs-ai-video", "status": "ok"}


@router.post(
    "/generate/script",
    response_model=ScriptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate video script",
)
async def post_generate_script(payload: ScriptRequest) -> ScriptResponse:
    """
    Generate a marketing video script for a lead/campaign pair.

    Args:
        payload: Lead and campaign context.

    Returns:
        Generated video script.
    """
    logger.info(
        "[bs_ai_video] /generate/script | campaign={}",
        payload.campaign_data.get("name"),
    )
    try:
        script = await generate_video_script(payload.lead_data, payload.campaign_data)
        return ScriptResponse(script=script)
    except Exception as exc:
        logger.error("[bs_ai_video] Script generation failed | {}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@router.post(
    "/render",
    response_model=RenderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Render video from script",
)
async def post_render_video(payload: RenderRequest) -> RenderResponse:
    """
    Render and upload a video from a script.

    Args:
        payload: Script text and template identifier.

    Returns:
        S3 URL of the rendered video.
    """
    logger.info("[bs_ai_video] /render | template={}", payload.template)
    try:
        url = await render_video(payload.script, payload.template)
        return RenderResponse(video_url=url, template=payload.template)
    except Exception as exc:
        logger.error("[bs_ai_video] Render failed | {}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )
