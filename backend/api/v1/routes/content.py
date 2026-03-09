# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/content.py
# DESCRIPTION  : FastAPI routes for AI content generation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid

from database.connection import get_db_session
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.controllers.content_controller import (
    handle_generate_content,
    handle_list_content,
)
from backend.api.v1.models.content import (
    ContentGenerateRequest,
    ContentGenerateResponse,
    ContentListResponse,
)
from backend.middleware.auth import get_current_user_id

router = APIRouter()


@router.post(
    "/generate",
    response_model=ContentGenerateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_content(
    request: ContentGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> ContentGenerateResponse:
    """
    Generate AI marketing content for a campaign.

    Supports: post, email, ad, newsletter, video_script.
    Falls back to template if AI API is unavailable.
    """
    return await handle_generate_content(db, request)


@router.get("/{campaign_id}", response_model=ContentListResponse)
async def list_content(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: uuid.UUID = Depends(get_current_user_id),
) -> ContentListResponse:
    """Return all generated content items for a campaign."""
    return await handle_list_content(db, campaign_id)
