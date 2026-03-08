# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/controllers/content_controller.py
# DESCRIPTION  : Request orchestration for content generation endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.content import (
    ContentGenerateRequest,
    ContentGenerateResponse,
    ContentListResponse,
    ContentResponse,
)
from backend.api.v1.services import content_service


async def handle_generate_content(
    db: AsyncSession,
    request: ContentGenerateRequest,
) -> ContentGenerateResponse:
    """Trigger AI content generation and persist result."""
    return await content_service.generate_content(db, request)


async def handle_list_content(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> ContentListResponse:
    """Return all content items for a campaign."""
    items = await content_service.list_content(db, campaign_id)
    return ContentListResponse(
        items=[ContentResponse.model_validate(c) for c in items],
        total=len(items),
    )
