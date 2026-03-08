# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/campaign.py
# DESCRIPTION  : Pydantic v2 request/response models for Campaign entity
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

from database.models_orm import CampaignChannel, CampaignStatus


class CampaignBase(BaseModel):
    """Shared fields for Campaign create/update."""

    name: str = Field(min_length=1, max_length=256)
    channel: CampaignChannel = Field(default=CampaignChannel.email)


class CampaignCreate(CampaignBase):
    """Request body for creating a campaign."""

    project_id: uuid.UUID


class CampaignUpdate(BaseModel):
    """Request body for updating a campaign (all optional)."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    status: Optional[CampaignStatus] = None
    channel: Optional[CampaignChannel] = None


class CampaignResponse(CampaignBase):
    """API response model for a campaign."""

    id: uuid.UUID
    project_id: uuid.UUID
    status: CampaignStatus
    created_at: datetime
    updated_at: datetime
    launched_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CampaignListResponse(BaseModel):
    """Paginated list of campaigns."""

    items: list[CampaignResponse]
    total: int
    page: int
    page_size: int


class CampaignLaunchResponse(BaseModel):
    """Response after launching a campaign."""

    campaign_id: uuid.UUID
    status: CampaignStatus
    launched_at: datetime
    job_id: Optional[uuid.UUID] = None
    message: str
