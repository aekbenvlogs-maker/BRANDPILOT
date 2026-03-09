# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/email.py
# DESCRIPTION  : Pydantic v2 request/response models for Email entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class EmailResponse(BaseModel):
    """API response model for an email record."""

    id: uuid.UUID
    campaign_id: uuid.UUID
    lead_id: uuid.UUID
    subject: str
    sent_at: datetime | None = None
    opened_at: datetime | None = None
    clicked_at: datetime | None = None
    bounced: bool
    unsubscribed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailTrackingEvent(BaseModel):
    """Payload for email tracking events (open, click)."""

    email_id: uuid.UUID
    event_type: str = Field(description="open | click | bounce | unsubscribe")
    link_url: str | None = Field(
        default=None, description="Clicked URL if event_type=click"
    )
    timestamp: datetime | None = None
