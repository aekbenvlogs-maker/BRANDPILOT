# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/campaigns.py
# DESCRIPTION  : FastAPI routes for Campaign CRUD and launch
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.controllers.campaign_controller import (
    handle_create_campaign,
    handle_delete_campaign,
    handle_get_campaign,
    handle_launch_campaign,
    handle_list_campaigns,
    handle_update_campaign,
)
from backend.api.v1.models.campaign import (
    CampaignCreate,
    CampaignLaunchResponse,
    CampaignListResponse,
    CampaignResponse,
    CampaignUpdate,
)
from backend.middleware.auth import get_current_user_id
from database.connection import get_db_session
from database.models_orm import CampaignStatus

router = APIRouter()


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    project_id: uuid.UUID,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Optional[CampaignStatus] = None,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> CampaignListResponse:
    """Return paginated campaigns for a project."""
    return await handle_list_campaigns(db, project_id, page, page_size, status_filter)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    data: CampaignCreate,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> CampaignResponse:
    """Create a new campaign in draft status."""
    return await handle_create_campaign(db, data)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> CampaignResponse:
    """Retrieve a campaign by ID."""
    return await handle_get_campaign(db, campaign_id)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    data: CampaignUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> CampaignResponse:
    """Update a campaign."""
    return await handle_update_campaign(db, campaign_id, data)


@router.post("/{campaign_id}/launch", response_model=CampaignLaunchResponse)
async def launch_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> CampaignLaunchResponse:
    """
    Launch a campaign — transitions status to 'active' and
    triggers the Lead-to-Content pipeline workflow.
    """
    return await handle_launch_campaign(db, campaign_id)


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK)
async def delete_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, str]:
    """Permanently delete a campaign and all its data."""
    return await handle_delete_campaign(db, campaign_id)
