# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_image/api.py
# DESCRIPTION  : FastAPI sub-router for AI image generation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from microservices.bs_ai_image.service import (
    _PLATFORM_SIZES,
    generate_marketing_image,
    resize_for_platform,
)

router = APIRouter(prefix="/bs-ai-image", tags=["bs-ai-image"])


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=5, description="Generation prompt")
    style: str = Field("photorealistic", description="Visual style")
    size: str = Field("1024x1024", description="Output dimensions")


class GenerateImageResponse(BaseModel):
    image_url: str
    size: str
    style: str


class ResizeRequest(BaseModel):
    image_url: str = Field(..., description="Source S3 image URL")
    platform: str = Field(..., description="Target social platform")


class ResizeResponse(BaseModel):
    resized_url: str
    platform: str
    dimensions: str


@router.get("/health", summary="Service health check")
async def health() -> dict[str, str]:
    """Return service liveness status."""
    return {"service": "bs-ai-image", "status": "ok"}


@router.post(
    "/generate/image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate marketing image",
)
async def post_generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    """
    Generate a marketing visual using DALL-E and upload to S3.

    Args:
        payload: Prompt, style, and size.

    Returns:
        S3 URL and metadata.
    """
    logger.info("[bs_ai_image] /generate/image | style={}", payload.style)
    try:
        url = await generate_marketing_image(
            payload.prompt, payload.style, payload.size
        )
        return GenerateImageResponse(
            image_url=url, size=payload.size, style=payload.style
        )
    except Exception as exc:
        logger.error("[bs_ai_image] Generation failed | error={}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@router.post(
    "/resize",
    response_model=ResizeResponse,
    summary="Resize image for platform",
)
async def post_resize(payload: ResizeRequest) -> ResizeResponse:
    """
    Resize an image for a specific social media platform.

    Args:
        payload: Source URL and target platform.

    Returns:
        Resized URL and platform metadata.
    """
    logger.info("[bs_ai_image] /resize | platform={}", payload.platform)
    try:
        resized_url = await resize_for_platform(payload.image_url, payload.platform)
        return ResizeResponse(
            resized_url=resized_url,
            platform=payload.platform,
            dimensions=_PLATFORM_SIZES.get(payload.platform, "1080x1080"),
        )
    except Exception as exc:
        logger.error("[bs_ai_image] Resize failed | error={}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )
