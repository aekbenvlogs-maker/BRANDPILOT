# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_email/double_optin.py
# DESCRIPTION  : CNIL/ePrivacy double opt-in flow — token generation + confirmation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import secrets
import uuid

import aiosmtplib
from database.connection import db_session
from database.models_orm import Lead
from loguru import logger
import redis.asyncio as aioredis
from sqlalchemy import select, update

from backend.api.v1.services.lead_service import decrypt_pii
from configs.settings import get_settings

settings = get_settings()

# Token TTL — 48 hours (CNIL recommendation)
_OPTIN_TOKEN_TTL_HOURS = 48
_REDIS_KEY_PREFIX = "brandscale:optin:"


async def _get_redis() -> aioredis.Redis:  # type: ignore[type-arg]
    """Return an async Redis client for opt-in token storage."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------
async def _store_optin_token(lead_id: str, token: str) -> None:
    """Store opt-in confirmation token in Redis with TTL."""
    ttl_seconds = _OPTIN_TOKEN_TTL_HOURS * 3600
    try:
        client = await _get_redis()
        await client.set(
            f"{_REDIS_KEY_PREFIX}{token}",
            json.dumps({"lead_id": lead_id}),
            ex=ttl_seconds,
        )
        logger.debug(
            "[double_optin] Token stored in Redis | lead={} ttl={}h",
            lead_id,
            _OPTIN_TOKEN_TTL_HOURS,
        )
    except Exception as exc:
        logger.error(
            "[double_optin] Redis store failed | lead={} error={}", lead_id, exc
        )
        raise


async def _validate_optin_token(token: str) -> str | None:
    """
    Validate a token and return the associated lead_id, or None if expired/invalid.
    Consumes the token on success (single-use via Redis DEL).
    """
    try:
        client = await _get_redis()
        raw = await client.get(f"{_REDIS_KEY_PREFIX}{token}")
        if not raw:
            logger.warning("[double_optin] Unknown token | token={}", token[:8])
            return None
        data = json.loads(raw)
        lead_id = data["lead_id"]
        # Single-use: delete token immediately after validation
        await client.delete(f"{_REDIS_KEY_PREFIX}{token}")
        return lead_id
    except Exception as exc:
        logger.error("[double_optin] Redis validate failed | error={}", exc)
        return None


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------
async def _send_confirmation_email(lead: Lead, confirm_url: str) -> bool:
    """Send the double opt-in confirmation email to the lead."""
    recipient = decrypt_pii(lead.email)
    if not recipient:
        logger.error("[double_optin] Cannot decrypt email for lead={}", lead.id)
        return False

    first_name = decrypt_pii(lead.first_name) or "there"
    subject = "Please confirm your subscription — BRANDSCALE"
    body_html = f"""
    <html><body>
    <p>Hi {first_name},</p>
    <p>Thank you for signing up! Please confirm your email address by clicking the link below.</p>
    <p><a href="{confirm_url}" style="background:#0055ff;color:#fff;padding:10px 20px;
       border-radius:4px;text-decoration:none;display:inline-block;">
       Confirm my subscription
    </a></p>
    <p>This link expires in {_OPTIN_TOKEN_TTL_HOURS} hours.</p>
    <p>If you did not sign up for BRANDSCALE, you can safely ignore this email.</p>
    <hr/>
    <p style="font-size:10px;color:#888;">BRANDSCALE — AI Brand Scaling Tool</p>
    </body></html>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = recipient
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        async with aiosmtplib.SMTP(
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            use_tls=settings.smtp_use_tls,
        ) as server:
            if settings.smtp_user and settings.smtp_password:
                await server.login(settings.smtp_user, settings.smtp_password)
            await server.send_message(msg)
        logger.info("[double_optin] Confirmation email sent | lead={}", lead.id)
        return True
    except Exception as exc:
        logger.error("[double_optin] Send failed | lead={} error={}", lead.id, str(exc))
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def send_double_optin_email(lead_id: str) -> bool:
    """
    Generate a confirmation token and send the opt-in email to the lead.

    The lead's opt_in remains False until confirm_optin() is called
    with the valid token.

    Args:
        lead_id: String UUID of the lead to send confirmation to.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    token = secrets.token_urlsafe(32)
    await _store_optin_token(lead_id, token)

    confirm_url = f"{settings.base_url}/api/v1/leads/confirm-optin/{token}"

    async with db_session() as session:
        result = await session.execute(
            select(Lead).where(Lead.id == uuid.UUID(lead_id))
        )
        lead = result.scalar_one_or_none()
        if not lead:
            logger.error("[double_optin] Lead not found | id={}", lead_id)
            return False
        return await _send_confirmation_email(lead, confirm_url)


async def confirm_optin(token: str) -> bool:
    """
    Validate the token and activate the lead's opt_in flag.

    Args:
        token: URL-safe token from the confirmation email.

    Returns:
        True if the lead was activated, False if token is invalid/expired.
    """
    lead_id = await _validate_optin_token(token)
    if not lead_id:
        return False

    async with db_session() as session:
        await session.execute(
            update(Lead)
            .where(Lead.id == uuid.UUID(lead_id))
            .values(
                opt_in=True,
                consent_date=datetime.now(UTC),
                consent_source="double_optin_email",
            )
        )
        await session.commit()
    logger.info("[double_optin] Lead activated (opt_in=True) | id={}", lead_id)
    return True


if __name__ == "__main__":
    print("[double_optin] Module loaded — double opt-in flow ready.")
