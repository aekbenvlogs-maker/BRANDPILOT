# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/services/content_service.py
# DESCRIPTION  : Business logic for AI content generation and retrieval
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import UTC, datetime
import uuid

from database.models_orm import Content, ContentType
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.content import (
    ContentGenerateRequest,
    ContentGenerateResponse,
)


async def generate_content(
    db: AsyncSession,
    request: ContentGenerateRequest,
) -> ContentGenerateResponse:
    """
    Trigger AI content generation via bs_ai_text microservice.

    Falls back to template if AI API is unavailable.

    Args:
        db:      Async database session.
        request: Validated content generation request.

    Returns:
        ContentGenerateResponse with generated text and metadata.
    """
    from microservices.bs_ai_text.service import (
        generate_ad_copy,
        generate_email_content,
        generate_newsletter,
        generate_post,
    )

    content_type = request.content_type
    campaign_id = request.campaign_id
    lead_id = request.lead_id

    # Call the appropriate microservice function
    body_text: str | None = None
    tokens_used: int | None = None
    cost_usd: float | None = None
    from_fallback = False

    try:
        if content_type == ContentType.post:
            result = await generate_post(
                lead_id=lead_id,
                tone=request.tone,
                platform=request.platform or "linkedin",
                language=request.language,
            )
        elif content_type == ContentType.email:
            result = await generate_email_content(
                lead_id=lead_id,
                campaign_id=campaign_id,
                language=request.language,
            )
        elif content_type == ContentType.ad:
            result = await generate_ad_copy(
                lead_id=lead_id,
                tone=request.tone,
                language=request.language,
            )
        elif content_type == ContentType.newsletter:
            result = await generate_newsletter(
                campaign_id=campaign_id,
                language=request.language,
            )
        else:
            # video_script — use post generation as proxy
            result = await generate_post(
                lead_id=lead_id,
                tone=request.tone,
                platform="video",
                language=request.language,
            )

        body_text = result.get("text")
        tokens_used = result.get("tokens_used")
        cost_usd = result.get("cost_usd")
        from_fallback = result.get("from_fallback", False)

    except Exception as exc:
        logger.warning(
            "[BRANDSCALE] AI generation failed — using fallback | error={}",
            str(exc),
        )
        from_fallback = True
        body_text = f"[Fallback content for {content_type.value}]"

    # Persist generated content
    content = Content(
        campaign_id=campaign_id,
        lead_id=lead_id,
        content_type=content_type,
        body_text=body_text,
        prompt_used=request.custom_instructions,
    )
    db.add(content)
    await db.flush()
    await db.refresh(content)

    logger.info(
        "[BRANDSCALE] Content generated | id={} type={} fallback={}",
        content.id,
        content_type.value,
        from_fallback,
    )

    return ContentGenerateResponse(
        content_id=content.id,
        content_type=content_type,
        body_text=body_text,
        tokens_used=tokens_used,
        cost_usd=cost_usd,
        generated_at=datetime.now(UTC),
        from_fallback=from_fallback,
    )


async def list_content(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> list[Content]:
    """
    Retrieve all content items for a campaign.

    Args:
        db:          Async database session.
        campaign_id: Campaign UUID.

    Returns:
        List of Content ORM objects.
    """
    result = await db.execute(
        select(Content)
        .where(Content.campaign_id == campaign_id)
        .order_by(Content.created_at.desc())
    )
    return list(result.scalars().all())


if __name__ == "__main__":
    print("[BRANDSCALE] content_service.py loaded")
