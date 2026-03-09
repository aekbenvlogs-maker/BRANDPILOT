# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/content.py
# DESCRIPTION  : Pydantic v2 request/response models for Content entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import datetime
import uuid

from database.models_orm import ContentType
from pydantic import BaseModel, Field


class ContentGenerateRequest(BaseModel):
    """Request body to trigger AI content generation."""

    campaign_id: uuid.UUID
    lead_id: uuid.UUID | None = None
    content_type: ContentType
    tone: str = Field(default="professional", max_length=64)
    platform: str | None = Field(default=None, max_length=64)
    custom_instructions: str | None = Field(default=None, max_length=512)
    language: str = Field(default="fr", max_length=10)


class ContentResponse(BaseModel):
    """API response model for a content item."""

    id: uuid.UUID
    campaign_id: uuid.UUID
    lead_id: uuid.UUID | None = None
    content_type: ContentType
    body_text: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    prompt_used: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentListResponse(BaseModel):
    """List of content items for a campaign."""

    items: list[ContentResponse]
    total: int


class ContentGenerateResponse(BaseModel):
    """Response after triggering content generation."""

    content_id: uuid.UUID
    content_type: ContentType
    body_text: str | None = None
    image_url: str | None = None
    tokens_used: int | None = None
    cost_usd: float | None = None
    generated_at: datetime
    from_fallback: bool = Field(
        default=False,
        description="True if content was generated from fallback template",
    )
