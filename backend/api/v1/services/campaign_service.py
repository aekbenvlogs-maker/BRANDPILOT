# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/services/campaign_service.py
# DESCRIPTION  : Business logic for Campaign CRUD and launch
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.campaign import CampaignCreate, CampaignUpdate
from database.models_orm import Campaign, CampaignStatus


async def create_campaign(
    db: AsyncSession, data: CampaignCreate
) -> Campaign:
    """
    Create a new campaign in draft status.

    Args:
        db:   Async database session.
        data: Validated campaign creation payload.

    Returns:
        Newly created Campaign ORM instance.
    """
    campaign = Campaign(
        project_id=data.project_id,
        name=data.name,
        channel=data.channel,
        status=CampaignStatus.draft,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    logger.info(
        "[BRANDSCALE] Campaign created | id={} name={}",
        campaign.id, campaign.name,
    )
    return campaign


async def list_campaigns(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[CampaignStatus] = None,
) -> tuple[list[Campaign], int]:
    """
    Return paginated campaigns for a project.

    Args:
        db:            Async database session.
        project_id:    Filter by project UUID.
        page:          Page number (1-indexed).
        page_size:     Items per page.
        status_filter: Optional status to filter by.

    Returns:
        Tuple of (campaign list, total count).
    """
    base_query = select(Campaign).where(Campaign.project_id == project_id)
    if status_filter is not None:
        base_query = base_query.where(Campaign.status == status_filter)

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(Campaign.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_campaign(
    db: AsyncSession, campaign_id: uuid.UUID
) -> Optional[Campaign]:
    """Fetch a single campaign by ID."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )
    return result.scalar_one_or_none()


async def update_campaign(
    db: AsyncSession, campaign: Campaign, data: CampaignUpdate
) -> Campaign:
    """Apply partial updates to a campaign."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
    await db.flush()
    await db.refresh(campaign)
    logger.info("[BRANDSCALE] Campaign updated | id={}", campaign.id)
    return campaign


async def launch_campaign(
    db: AsyncSession, campaign: Campaign
) -> Campaign:
    """
    Mark campaign as active and record launch timestamp.

    Args:
        db:       Async database session.
        campaign: Campaign ORM object to launch.

    Returns:
        Updated Campaign with status=active.
    """
    campaign.status = CampaignStatus.active
    campaign.launched_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    logger.info("[BRANDSCALE] Campaign launched | id={}", campaign.id)
    return campaign


async def delete_campaign(db: AsyncSession, campaign: Campaign) -> None:
    """Hard delete a campaign and all related data (cascade)."""
    await db.delete(campaign)
    await db.flush()
    logger.info("[BRANDSCALE] Campaign deleted | id={}", campaign.id)


if __name__ == "__main__":
    print("[BRANDSCALE] campaign_service.py loaded")
