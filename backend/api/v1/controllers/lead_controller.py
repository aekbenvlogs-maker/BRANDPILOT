# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/controllers/lead_controller.py
# DESCRIPTION  : Request orchestration for lead endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid

from database.models_orm import ScoreTier
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.lead import (
    LeadCreate,
    LeadImportResponse,
    LeadListResponse,
    LeadResponse,
    LeadUpdate,
)
from backend.api.v1.services import lead_service


async def handle_create_lead(db: AsyncSession, data: LeadCreate) -> LeadResponse:
    """Create a lead with encrypted PII."""
    lead = await lead_service.create_lead(db, data)
    return LeadResponse.model_validate(lead)


async def handle_list_leads(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
    tier_filter: ScoreTier | None,
    sector_filter: str | None,
) -> LeadListResponse:
    """List leads with pagination and filters."""
    leads, total = await lead_service.list_leads(
        db, project_id, page, page_size, tier_filter, sector_filter
    )
    return LeadListResponse(
        items=[LeadResponse.model_validate(lead) for lead in leads],
        total=total,
        page=page,
        page_size=page_size,
    )


async def handle_get_lead(db: AsyncSession, lead_id: uuid.UUID) -> LeadResponse:
    """Fetch lead by ID or raise 404."""
    lead = await lead_service.get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    return LeadResponse.model_validate(lead)


async def handle_update_lead(
    db: AsyncSession, lead_id: uuid.UUID, data: LeadUpdate
) -> LeadResponse:
    """Update lead or raise 404."""
    lead = await lead_service.get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    updated = await lead_service.update_lead(db, lead, data)
    return LeadResponse.model_validate(updated)


async def handle_delete_lead(db: AsyncSession, lead_id: uuid.UUID) -> dict[str, str]:
    """RGPD delete — permanently remove lead data."""
    lead = await lead_service.get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    await lead_service.delete_lead(db, lead)
    return {"message": f"Lead {lead_id} permanently deleted (RGPD compliance)."}


async def handle_import_leads_csv(
    db: AsyncSession,
    project_id: uuid.UUID,
    file: UploadFile,
    default_opt_in: bool,
) -> LeadImportResponse:
    """Import leads from uploaded CSV file."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted.",
        )

    content = await file.read()
    return await lead_service.import_leads_from_csv(
        db, project_id, content, default_opt_in
    )
