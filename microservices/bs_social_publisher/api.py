# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/api.py
# DESCRIPTION  : FastAPI router for social publishing endpoints
# NOTE         : OAuth endpoints use NO JWT (public redirect flow)
#                All other endpoints require authentication middleware
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from microservices.bs_social_publisher.oauth_manager import oauth_manager
from microservices.bs_social_publisher.worker import (
    celery_app,
    collect_metrics_task,
    publish_post_task,
)
from database.connection import db_session
from sqlalchemy import text

router = APIRouter(prefix="/social", tags=["social"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PublishRequest(BaseModel):
    social_account_id: str


class TaskResponse(BaseModel):
    task_id: str
    status: str = "queued"


# ---------------------------------------------------------------------------
# OAuth flow (NO JWT — public endpoints)
# ---------------------------------------------------------------------------

@router.get("/oauth/{platform}/authorize")
async def oauth_authorize(
    platform: str,
    project_id: str,
    redirect_uri: str,
) -> dict:
    """
    Return the OAuth authorization URL for a given platform.
    The frontend should redirect the user to this URL.
    """
    try:
        url = oauth_manager.get_authorization_url(
            platform=platform,
            project_id=project_id,
            redirect_uri=redirect_uri,
        )
        return {"authorization_url": url}
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")


@router.get("/oauth/{platform}/callback")
async def oauth_callback(
    platform: str,
    code: str,
    state: str,
    redirect_uri: str,
    request: Request,
) -> dict:
    """
    Handle the OAuth callback, exchange code for token, persist (encrypted).
    Extracts project_id from the state parameter (format: '{project_id}:{nonce}').
    """
    project_id = state.split(":")[0]
    try:
        token = await oauth_manager.exchange_code_for_token(
            platform=platform,
            code=code,
            redirect_uri=redirect_uri,
            project_id=project_id,
        )
        return {
            "status":   "connected",
            "platform": platform,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {type(exc).__name__}")


# ---------------------------------------------------------------------------
# Protected endpoints (require auth middleware — applied at app level)
# ---------------------------------------------------------------------------

@router.get("/accounts")
async def list_social_accounts(project_id: str) -> list[dict]:
    """List connected social accounts for a project (tokens NOT returned)."""
    async with db_session() as session:
        rows = await session.execute(
            text("""
                SELECT id, project_id, platform, token_expires_at, created_at
                FROM social_accounts
                WHERE project_id = :project_id
                ORDER BY created_at DESC
            """),
            {"project_id": project_id},
        )
        accounts = [dict(r) for r in rows.mappings()]
    return accounts


@router.delete("/accounts/{account_id}", status_code=204)
async def disconnect_social_account(account_id: str) -> None:
    """Revoke and delete a connected social account."""
    success = await oauth_manager.revoke_token(account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found or already removed")


@router.post("/posts/{post_id}/publish", status_code=202, response_model=TaskResponse)
async def publish_post_endpoint(post_id: str, body: PublishRequest) -> TaskResponse:
    """Trigger async publication of an approved post."""
    task = publish_post_task.delay(
        post_id=post_id,
        social_account_id=body.social_account_id,
    )
    return TaskResponse(task_id=task.id)


@router.get("/analytics/{campaign_id}")
async def get_campaign_analytics(campaign_id: str) -> list[dict]:
    """Retrieve collected social metrics for all posts in a campaign."""
    async with db_session() as session:
        rows = await session.execute(
            text("""
                SELECT c.id AS post_id,
                       c.metadata->>'platform_post_id' AS platform_post_id,
                       c.status,
                       c.metadata
                FROM content c
                WHERE c.campaign_id = :campaign_id
                  AND c.status = 'published'
                ORDER BY c.created_at DESC
            """),
            {"campaign_id": campaign_id},
        )
        posts = [dict(r) for r in rows.mappings()]
    return posts


@router.get("/tasks/{task_id}")
async def get_task_result(task_id: str) -> dict:
    """Poll the result of a publish or metrics task."""
    from celery.result import AsyncResult
    result = AsyncResult(task_id, app=celery_app)
    if result.state == "PENDING":
        return {"status": "pending"}
    if result.state == "FAILURE":
        raise HTTPException(status_code=500, detail=str(result.result))
    return {"status": result.state, "result": result.result}
