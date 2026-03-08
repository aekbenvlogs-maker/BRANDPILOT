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

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EmailResponse(BaseModel):
    """API response model for an email record."""

    id: uuid.UUID
    campaign_id: uuid.UUID
    lead_id: uuid.UUID
    subject: str
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    bounced: bool
    unsubscribed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailTrackingEvent(BaseModel):
    """Payload for email tracking events (open, click)."""

    email_id: uuid.UUID
    event_type: str = Field(description="open | click | bounce | unsubscribe")
    link_url: Optional[str] = Field(default=None, description="Clicked URL if event_type=click")
    timestamp: Optional[datetime] = None
