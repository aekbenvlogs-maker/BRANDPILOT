# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_text/api.py
# DESCRIPTION  : FastAPI sub-router for bs_ai_text microservice
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from microservices.bs_ai_text.service import (
    generate_ad_copy,
    generate_email_content,
    generate_newsletter,
    generate_post,
    generate_video_script,
)

router = APIRouter(prefix="/bs_ai_text", tags=["bs_ai_text"])


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------
class GeneratePostRequest(BaseModel):
    """Request body for post generation."""

    lead_id: Optional[uuid.UUID] = None
    tone: str = "professional"
    platform: str = "linkedin"
    language: str = "fr"


class GenerateEmailRequest(BaseModel):
    """Request body for email generation."""

    lead_id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    language: str = "fr"


class GenerateAdRequest(BaseModel):
    """Request body for ad copy generation."""

    lead_id: Optional[uuid.UUID] = None
    tone: str = "persuasive"
    language: str = "fr"


class GenerateNewsletterRequest(BaseModel):
    """Request body for newsletter generation."""

    campaign_id: uuid.UUID
    language: str = "fr"


class GenerateVideoScriptRequest(BaseModel):
    """Request body for video script generation."""

    lead_id: Optional[uuid.UUID] = None
    campaign_id: uuid.UUID
    language: str = "fr"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/health")
async def health() -> dict[str, str]:
    """Health check for bs_ai_text microservice."""
    return {"service": "bs_ai_text", "status": "healthy"}


@router.post("/generate/post")
async def api_generate_post(body: GeneratePostRequest) -> dict[str, Any]:
    """Generate a social media post."""
    try:
        return await generate_post(body.lead_id, body.tone, body.platform, body.language)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/generate/email")
async def api_generate_email(body: GenerateEmailRequest) -> dict[str, Any]:
    """Generate a personalised marketing email."""
    try:
        return await generate_email_content(body.lead_id, body.campaign_id, body.language)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/generate/ad")
async def api_generate_ad(body: GenerateAdRequest) -> dict[str, Any]:
    """Generate ad copy."""
    try:
        return await generate_ad_copy(body.lead_id, body.tone, body.language)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/generate/newsletter")
async def api_generate_newsletter(body: GenerateNewsletterRequest) -> dict[str, Any]:
    """Generate a full newsletter."""
    try:
        return await generate_newsletter(body.campaign_id, body.language)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/generate/video_script")
async def api_generate_video_script(body: GenerateVideoScriptRequest) -> dict[str, Any]:
    """Generate a video marketing script."""
    try:
        return await generate_video_script(body.lead_id, body.campaign_id, body.language)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
