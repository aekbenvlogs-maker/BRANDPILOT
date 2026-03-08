# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_email/api.py
# DESCRIPTION  : FastAPI sub-router for email operations
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field

from microservices.bs_email.service import (
    create_sequence,
    send_email,
    track_click,
    track_open,
    unsubscribe,
)

router = APIRouter(prefix="/bs-email", tags=["bs-email"])


class SequenceRequest(BaseModel):
    campaign_data: dict[str, Any] = Field(..., description="Campaign context")
    leads: list[dict[str, Any]] = Field(..., description="List of lead dicts")
    template_html: str = Field(..., description="HTML email template")


class SequenceResponse(BaseModel):
    email_ids: list[str]
    count: int


class SendRequest(BaseModel):
    email_id: str = Field(..., description="Email record UUID")


class TrackClickRequest(BaseModel):
    email_id: str
    link: str


@router.get("/health", summary="Service health check")
async def health() -> dict[str, str]:
    """Return service liveness status."""
    return {"service": "bs-email", "status": "ok"}


@router.post(
    "/sequence",
    response_model=SequenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create email sequence",
)
async def post_create_sequence(payload: SequenceRequest) -> SequenceResponse:
    """
    Create email records for all opted-in leads in a campaign.

    Args:
        payload: Campaign, leads, and HTML template.

    Returns:
        List of created email IDs and count.
    """
    logger.info("[bs_email] /sequence | {} leads", len(payload.leads))
    try:
        ids = await create_sequence(payload.campaign_data, payload.leads, payload.template_html)
        return SequenceResponse(email_ids=ids, count=len(ids))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/send", summary="Send a single email")
async def post_send_email(payload: SendRequest) -> dict[str, Any]:
    """
    Send an email by its database ID.

    Args:
        payload: Email record UUID.

    Returns:
        Success flag and email_id.
    """
    logger.info("[bs_email] /send | email_id={}", payload.email_id)
    try:
        success = await send_email(payload.email_id)
        return {"email_id": payload.email_id, "sent": success}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/track/open", summary="Track email open")
async def post_track_open(email_id: str = Query(...)) -> dict[str, str]:
    """Record an open event for a 1x1 tracking pixel."""
    await track_open(email_id)
    return {"status": "tracked"}


@router.post("/track/click", summary="Track email link click")
async def post_track_click(payload: TrackClickRequest) -> dict[str, str]:
    """Record a link click event."""
    await track_click(payload.email_id, payload.link)
    return {"status": "tracked"}


@router.post("/unsubscribe", summary="RGPD unsubscribe")
async def post_unsubscribe(lead_id: str = Query(...)) -> dict[str, str]:
    """Process RGPD-compliant unsubscribe request."""
    logger.info("[bs_email] /unsubscribe | lead_id={}", lead_id)
    await unsubscribe(lead_id)
    return {"status": "unsubscribed", "lead_id": lead_id}
