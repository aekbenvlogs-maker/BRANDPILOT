# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/leads.py
# DESCRIPTION  : FastAPI routes for Lead CRUD and CSV import
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.controllers.lead_controller import (
    handle_create_lead,
    handle_delete_lead,
    handle_get_lead,
    handle_import_leads_csv,
    handle_list_leads,
    handle_update_lead,
)
from backend.api.v1.models.lead import (
    LeadCreate,
    LeadImportResponse,
    LeadListResponse,
    LeadResponse,
    LeadUpdate,
)
from backend.middleware.auth import get_current_user_id
from database.connection import get_db_session
from database.models_orm import ScoreTier

router = APIRouter()


@router.get("", response_model=LeadListResponse)
async def list_leads(
    project_id: uuid.UUID,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    tier: Optional[ScoreTier] = None,
    sector: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> LeadListResponse:
    """Return paginated leads with optional tier/sector filters."""
    return await handle_list_leads(db, project_id, page, page_size, tier, sector)


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> LeadResponse:
    """Create a new lead with encrypted PII."""
    return await handle_create_lead(db, data)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> LeadResponse:
    """Retrieve a lead by ID."""
    return await handle_get_lead(db, lead_id)


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> LeadResponse:
    """Update a lead's fields."""
    return await handle_update_lead(db, lead_id, data)


@router.delete("/{lead_id}", status_code=status.HTTP_200_OK)
async def delete_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, str]:
    """Permanently delete a lead — RGPD compliant."""
    return await handle_delete_lead(db, lead_id)


@router.post("/import", response_model=LeadImportResponse, status_code=status.HTTP_200_OK)
async def import_leads_csv(
    project_id: uuid.UUID,
    default_opt_in: bool = False,
    file: UploadFile = File(..., description="CSV file with lead data"),
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> LeadImportResponse:
    """
    Bulk import leads from a CSV file.

    Expected CSV columns: email, first_name, last_name, company, sector, source, opt_in
    """
    return await handle_import_leads_csv(db, project_id, file, default_opt_in)
