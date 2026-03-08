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

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from database.models_orm import ContentType


class ContentGenerateRequest(BaseModel):
    """Request body to trigger AI content generation."""

    campaign_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    content_type: ContentType
    tone: str = Field(default="professional", max_length=64)
    platform: Optional[str] = Field(default=None, max_length=64)
    custom_instructions: Optional[str] = Field(default=None, max_length=512)
    language: str = Field(default="fr", max_length=10)


class ContentResponse(BaseModel):
    """API response model for a content item."""

    id: uuid.UUID
    campaign_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    content_type: ContentType
    body_text: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    prompt_used: Optional[str] = None
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
    body_text: Optional[str] = None
    image_url: Optional[str] = None
    tokens_used: Optional[int] = None
    cost_usd: Optional[float] = None
    generated_at: datetime
    from_fallback: bool = Field(
        default=False,
        description="True if content was generated from fallback template",
    )
