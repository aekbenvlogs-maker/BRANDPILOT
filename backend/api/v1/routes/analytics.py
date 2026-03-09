# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/analytics.py
# DESCRIPTION  : FastAPI routes for campaign analytics
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid

from database.connection import get_db_session
from database.models_orm import Analytics, Campaign, CampaignStatus, Lead, ScoreTier
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.analytics import AnalyticsResponse, AnalyticsSummaryResponse
from backend.middleware.auth import get_current_user_id

router = APIRouter()


@router.get("/{campaign_id}", response_model=list[AnalyticsResponse])
async def get_campaign_analytics(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> list[AnalyticsResponse]:
    """Return all daily analytics records for a campaign."""
    result = await db.execute(
        select(Analytics)
        .where(Analytics.campaign_id == campaign_id)
        .order_by(Analytics.date.asc())
    )
    items = result.scalars().all()
    return [AnalyticsResponse.model_validate(a) for a in items]


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
) -> AnalyticsSummaryResponse:
    """
    Return aggregated analytics summary across all campaigns.

    Includes KPIs: emails sent, open rate, CTR, conversions, AI cost.
    """
    # Active campaigns count
    active_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.active)
    )
    active_campaigns = active_result.scalar_one() or 0

    # Aggregate analytics
    agg_result = await db.execute(
        select(
            func.coalesce(func.sum(Analytics.emails_sent), 0).label("total_emails"),
            func.coalesce(func.avg(Analytics.open_rate), 0.0).label("avg_open"),
            func.coalesce(func.avg(Analytics.ctr), 0.0).label("avg_ctr"),
            func.coalesce(func.sum(Analytics.conversions), 0).label("total_conv"),
            func.coalesce(func.sum(Analytics.ai_cost_usd), 0.0).label("total_cost"),
        )
    )
    agg = agg_result.one()

    # Lead tier counts (all leads)
    hot_r = await db.execute(
        select(func.count(Lead.id)).where(Lead.score_tier == ScoreTier.hot)
    )
    warm_r = await db.execute(
        select(func.count(Lead.id)).where(Lead.score_tier == ScoreTier.warm)
    )
    cold_r = await db.execute(
        select(func.count(Lead.id)).where(Lead.score_tier == ScoreTier.cold)
    )
    total_leads_r = await db.execute(select(func.count(Lead.id)))

    return AnalyticsSummaryResponse(
        total_emails_sent=int(agg.total_emails),
        avg_open_rate=float(agg.avg_open),
        avg_ctr=float(agg.avg_ctr),
        total_conversions=int(agg.total_conv),
        total_ai_cost_usd=float(agg.total_cost),
        active_campaigns=int(active_campaigns),
        total_leads=int(total_leads_r.scalar_one() or 0),
        hot_leads=int(hot_r.scalar_one() or 0),
        warm_leads=int(warm_r.scalar_one() or 0),
        cold_leads=int(cold_r.scalar_one() or 0),
    )
