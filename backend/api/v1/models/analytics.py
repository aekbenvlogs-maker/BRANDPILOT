# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/analytics.py
# DESCRIPTION  : Pydantic v2 request/response models for Analytics entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import date, datetime
import uuid

from pydantic import BaseModel, Field


class AnalyticsResponse(BaseModel):
    """API response for daily campaign analytics."""

    id: uuid.UUID
    campaign_id: uuid.UUID
    date: date
    emails_sent: int
    open_rate: float = Field(description="Open rate as percentage 0-100")
    ctr: float = Field(description="Click-through rate as percentage 0-100")
    conversions: int
    ai_cost_usd: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsSummaryResponse(BaseModel):
    """Summary analytics across all campaigns."""

    total_emails_sent: int
    avg_open_rate: float
    avg_ctr: float
    total_conversions: int
    total_ai_cost_usd: float
    active_campaigns: int
    total_leads: int
    hot_leads: int
    warm_leads: int
    cold_leads: int
    period_start: date | None = None
    period_end: date | None = None
