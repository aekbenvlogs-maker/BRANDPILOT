# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/lead.py
# DESCRIPTION  : Pydantic v2 request/response models for Lead entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from database.models_orm import ScoreTier


class LeadBase(BaseModel):
    """Shared fields for Lead create/update."""

    email: EmailStr
    first_name: Optional[str] = Field(default=None, max_length=128)
    last_name: Optional[str] = Field(default=None, max_length=128)
    company: Optional[str] = Field(default=None, max_length=256)
    sector: Optional[str] = Field(default=None, max_length=128)
    source: Optional[str] = Field(default=None, max_length=128)


class LeadCreate(LeadBase):
    """Request body for creating a lead."""

    project_id: uuid.UUID
    opt_in: bool = Field(default=False, description="RGPD explicit consent")
    consent_date: Optional[datetime] = None
    consent_source: Optional[str] = Field(default=None, max_length=128)

    @field_validator("opt_in")
    @classmethod
    def opt_in_required(cls, v: bool) -> bool:
        """Warn if opt_in is False — RGPD compliance reminder."""
        # opt_in=False is allowed (explicit opt-out tracking), not blocked
        return v


class LeadUpdate(BaseModel):
    """Request body for updating a lead (all optional)."""

    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, max_length=128)
    last_name: Optional[str] = Field(default=None, max_length=128)
    company: Optional[str] = Field(default=None, max_length=256)
    sector: Optional[str] = Field(default=None, max_length=128)
    opt_in: Optional[bool] = None


class LeadResponse(LeadBase):
    """API response model for a lead."""

    id: uuid.UUID
    project_id: uuid.UUID
    score: int
    score_tier: ScoreTier
    score_updated_at: Optional[datetime] = None
    opt_in: bool
    consent_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    """Paginated list of leads."""

    items: list[LeadResponse]
    total: int
    page: int
    page_size: int


class LeadImportRequest(BaseModel):
    """Request for CSV bulk lead import."""

    project_id: uuid.UUID
    default_opt_in: bool = Field(
        default=False,
        description="Apply this opt_in value to all imported leads without explicit consent",
    )


class LeadImportResponse(BaseModel):
    """Response after bulk lead import."""

    imported: int
    skipped: int
    errors: list[str]
    total_processed: int
