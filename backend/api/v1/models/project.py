# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/project.py
# DESCRIPTION  : Pydantic v2 request/response models for Project entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    """Shared fields for Project create/update."""

    name: str = Field(min_length=1, max_length=256, description="Project name")
    description: str | None = Field(default=None, description="Project description")


class ProjectCreate(ProjectBase):
    """Request body for creating a new project."""

    brand_url: str | None = Field(
        default=None,
        description=(
            "Brand website URL. When provided, triggers automatic brand analysis "
            "(tone, colours, keywords, competitors) in the background."
        ),
    )


class ProjectUpdate(BaseModel):
    """Request body for updating a project (all optional)."""

    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    archived: bool | None = None
    brand_url: str | None = Field(
        default=None,
        description="Update the brand website URL (triggers re-analysis via POST /{id}/analyze-brand).",
    )


class ProjectResponse(ProjectBase):
    """API response model for a project."""

    id: uuid.UUID
    user_id: uuid.UUID
    archived: bool
    brand_url: str | None = None
    tone: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    """Paginated list of projects."""

    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
