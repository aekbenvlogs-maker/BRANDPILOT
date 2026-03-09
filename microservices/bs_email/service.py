# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_email/service.py
# DESCRIPTION  : Email sequence creation, sending, tracking, RGPD
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any
import uuid

import re

import aiosmtplib
from database.connection import db_session
from database.crypto import decrypt_pii
from database.models_orm import Email, Lead
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from configs.settings import get_settings

settings = get_settings()

_UNSUBSCRIBE_BASE = "https://app.brandscale.ai/unsubscribe"


def _build_unsubscribe_link(lead_id: str) -> str:
    """Return RGPD-compliant unsubscribe URL for a lead."""
    return f"{_UNSUBSCRIBE_BASE}?lead_id={lead_id}"


def _build_email_body(
    template_html: str, lead_data: dict[str, Any], unsubscribe_url: str
) -> str:
    """Inject lead context and mandatory unsubscribe link into an HTML template.

    Uses a single re.sub pass instead of N str.replace calls — O(len(template))
    regardless of the number of lead fields.
    """
    body = re.sub(
        r"\{\{(\w+)\}\}",
        lambda m: str(lead_data.get(m.group(1), m.group(0))),
        template_html,
    )
    unsubscribe_block = (
        f'<p style="font-size:10px;color:#888;">Click <a href="{unsubscribe_url}">here</a>'
        " to unsubscribe at any time.</p>"
    )
    return body + unsubscribe_block


async def create_sequence(
    campaign_data: dict[str, Any],
    leads: list[dict[str, Any]],
    template_html: str,
    session: AsyncSession | None = None,
) -> list[str]:
    """
    Create an email sequence for a list of leads within a campaign.

    Args:
        campaign_data: Campaign metadata (id, name, subject).
        leads:         List of lead dicts with id, email, first_name.
        template_html: HTML email body template with {{placeholders}}.
        session:       Optional injected async DB session.

    Returns:
        List of created Email record IDs.
    """
    campaign_id = campaign_data.get("id", str(uuid.uuid4()))
    subject = campaign_data.get("subject", "Your personalised message")
    created_ids: list[str] = []

    async def _create(s: AsyncSession) -> None:
        records: list[Email] = []
        for lead in leads:
            if not lead.get("opt_in"):
                logger.info("[bs_email] Skipping lead {} — no opt_in", lead.get("id"))
                continue
            try:
                lead_uuid = uuid.UUID(str(lead["id"]))
                camp_uuid = uuid.UUID(str(campaign_id))
            except (ValueError, KeyError):
                logger.warning("[bs_email] Invalid UUID — skipping lead {}", lead.get("id"))
                continue
            unsubscribe_url = _build_unsubscribe_link(str(lead["id"]))
            body = _build_email_body(template_html, lead, unsubscribe_url)
            email_record = Email(
                id=uuid.uuid4(),
                campaign_id=camp_uuid,
                lead_id=lead_uuid,
                subject=subject,
                body=body,
            )
            records.append(email_record)
            created_ids.append(str(email_record.id))
        if records:
            s.add_all(records)
            await s.flush()
        await s.commit()

    if session:
        await _create(session)
    else:
        async with db_session() as s:
            await _create(s)

    logger.info(
        "[bs_email] Sequence created | {} emails | campaign={}",
        len(created_ids),
        campaign_id,
    )
    return created_ids


async def send_email(email_id: str) -> bool:
    """
    Send a single email record via SMTP.

    Args:
        email_id: Database ID of the Email record to send.

    Returns:
        True on success, False on failure.
    """
    # Cast early — avoids InvalidTextRepresentation on PostgreSQL/asyncpg.
    try:
        email_uuid = uuid.UUID(email_id)
    except ValueError:
        logger.warning("[bs_email] send_email — invalid UUID | id={}", email_id)
        return False

    async with db_session() as session:
        # Single JOIN query instead of two sequential SELECTs.
        row = (
            await session.execute(
                select(Email, Lead)
                .join(Lead, Email.lead_id == Lead.id)
                .where(Email.id == email_uuid)
            )
        ).one_or_none()
        if not row:
            logger.warning("[bs_email] Email not found | id={}", email_id)
            return False
        email, lead = row
        if not lead.opt_in:
            logger.info(
                "[bs_email] Email skipped — opt_in=False | email_id={}",
                email_id,
            )
            return False
        recipient = decrypt_pii(lead.email)
        if not recipient:
            logger.warning("[bs_email] No recipient for email_id={}", email_id)
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = email.subject
            msg["From"] = settings.smtp_from_email
            msg["To"] = recipient
            msg.attach(MIMEText(email.body, "html", "utf-8"))
            async with aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=settings.smtp_use_tls,
            ) as server:
                if settings.smtp_user and settings.smtp_password:
                    await server.login(settings.smtp_user, settings.smtp_password)
                await server.send_message(msg)
            await session.execute(
                update(Email)
                .where(Email.id == email_uuid)
                .values(sent_at=datetime.now(UTC))
            )
            await session.commit()
            logger.info("[bs_email] Email sent | id={}", email_id)
            return True
        except Exception as exc:
            # Ne pas committer — db_session() effectue le rollback automatiquement.
            logger.error("[bs_email] Send failed | id={} | {}", email_id, str(exc))
            return False


async def track_open(email_id: str) -> None:
    """
    Record an email open event.

    Args:
        email_id: Database ID of the tracked Email.
    """
    try:
        email_uuid = uuid.UUID(email_id)
    except ValueError:
        logger.warning("[bs_email] track_open — invalid UUID | id={}", email_id)
        return

    async with db_session() as session:
        result = await session.execute(select(Email).where(Email.id == email_uuid))
        email_record = result.scalar_one_or_none()
        if not email_record:
            logger.warning("[bs_email] track_open — email not found | id={}", email_id)
            return
        await session.execute(
            update(Email)
            .where(Email.id == email_uuid)
            .values(opened_at=datetime.now(UTC))
        )
        await session.execute(
            update(Lead)
            .where(Lead.id == email_record.lead_id)
            .values(email_opens=Lead.email_opens + 1)
        )
        await session.commit()
    logger.info("[bs_email] Open tracked | email_id={}", email_id)


async def track_click(email_id: str, link: str) -> None:
    """
    Record an email link click event.

    Args:
        email_id: Database ID of the tracked Email.
        link:     URL that was clicked.
    """
    try:
        email_uuid = uuid.UUID(email_id)
    except ValueError:
        logger.warning("[bs_email] track_click — invalid UUID | id={}", email_id)
        return

    async with db_session() as session:
        result = await session.execute(select(Email).where(Email.id == email_uuid))
        email_record = result.scalar_one_or_none()
        if not email_record:
            logger.warning("[bs_email] track_click — email not found | id={}", email_id)
            return
        await session.execute(
            update(Email)
            .where(Email.id == email_uuid)
            .values(clicked_at=datetime.now(UTC))
        )
        await session.execute(
            update(Lead)
            .where(Lead.id == email_record.lead_id)
            .values(email_clicks=Lead.email_clicks + 1)
        )
        await session.commit()
    logger.info("[bs_email] Click tracked | email_id={} | link={}", email_id, link)


async def unsubscribe(lead_id: str) -> None:
    """
    RGPD-compliant unsubscribe: mark lead opt_in=False within 24 h.

    Args:
        lead_id: Database ID of the Lead requesting unsubscription.
    """
    async with db_session() as session:
        await session.execute(
            update(Lead).where(Lead.id == lead_id).values(opt_in=False)
        )
        await session.execute(
            update(Email).where(Email.lead_id == lead_id).values(unsubscribed=True)
        )
        await session.commit()
    logger.info("[bs_email] Unsubscribed | lead_id={}", lead_id)
