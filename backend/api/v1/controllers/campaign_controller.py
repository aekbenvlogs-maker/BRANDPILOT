# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/controllers/campaign_controller.py
# DESCRIPTION  : Request orchestration for campaign endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.campaign import (
    CampaignCreate,
    CampaignLaunchResponse,
    CampaignListResponse,
    CampaignResponse,
    CampaignUpdate,
)
from backend.api.v1.services import campaign_service
from database.models_orm import CampaignStatus


async def handle_create_campaign(
    db: AsyncSession, data: CampaignCreate
) -> CampaignResponse:
    """Create a campaign and return the response model."""
    campaign = await campaign_service.create_campaign(db, data)
    return CampaignResponse.model_validate(campaign)


async def handle_list_campaigns(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
    status_filter: Optional[CampaignStatus],
) -> CampaignListResponse:
    """List campaigns with pagination and optional status filter."""
    campaigns, total = await campaign_service.list_campaigns(
        db, project_id, page, page_size, status_filter
    )
    return CampaignListResponse(
        items=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        page=page,
        page_size=page_size,
    )


async def handle_get_campaign(
    db: AsyncSession, campaign_id: uuid.UUID
) -> CampaignResponse:
    """Fetch campaign or raise 404."""
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found.",
        )
    return CampaignResponse.model_validate(campaign)


async def handle_update_campaign(
    db: AsyncSession, campaign_id: uuid.UUID, data: CampaignUpdate
) -> CampaignResponse:
    """Update campaign or raise 404."""
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found.",
        )
    updated = await campaign_service.update_campaign(db, campaign, data)
    return CampaignResponse.model_validate(updated)


async def handle_launch_campaign(
    db: AsyncSession, campaign_id: uuid.UUID
) -> CampaignLaunchResponse:
    """
    Launch a campaign.

    Only campaigns in 'draft' or 'paused' status can be launched.
    Triggers the L2C workflow via Celery.
    """
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found.",
        )
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.paused):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch campaign with status '{campaign.status.value}'.",
        )

    launched = await campaign_service.launch_campaign(db, campaign)

    # Fire Celery workflow asynchronously
    job_id: Optional[uuid.UUID] = None
    try:
        from microservices.workflow import run_l2c_pipeline

        task = run_l2c_pipeline.delay(str(campaign_id))
        job_id = uuid.UUID(task.id) if task.id else None
    except Exception:
        pass  # Workflow trigger failure is non-blocking

    return CampaignLaunchResponse(
        campaign_id=launched.id,
        status=launched.status,
        launched_at=launched.launched_at or datetime.now(timezone.utc),
        job_id=job_id,
        message="Campaign launched. Workflow pipeline initiated.",
    )


async def handle_delete_campaign(
    db: AsyncSession, campaign_id: uuid.UUID
) -> dict[str, str]:
    """Delete a campaign or raise 404."""
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found.",
        )
    await campaign_service.delete_campaign(db, campaign)
    return {"message": f"Campaign {campaign_id} deleted."}
