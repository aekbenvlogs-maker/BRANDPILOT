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

import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from configs.settings import get_settings
from database.connection import db_session
from database.models_orm import Email, Lead

settings = get_settings()

_UNSUBSCRIBE_BASE = "https://app.brandscale.ai/unsubscribe"


def _build_unsubscribe_link(lead_id: str) -> str:
    """Return RGPD-compliant unsubscribe URL for a lead."""
    return f"{_UNSUBSCRIBE_BASE}?lead_id={lead_id}"


def _build_email_body(template_html: str, lead_data: dict[str, Any], unsubscribe_url: str) -> str:
    """Inject lead context and mandatory unsubscribe link into an HTML template."""
    body = template_html
    for key, value in lead_data.items():
        body = body.replace(f"{{{{{key}}}}}", str(value))
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
        for lead in leads:
            if not lead.get("opt_in"):
                logger.info("[bs_email] Skipping lead {} — no opt_in", lead.get("id"))
                continue
            unsubscribe_url = _build_unsubscribe_link(str(lead["id"]))
            body = _build_email_body(template_html, lead, unsubscribe_url)
            email_record = Email(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                lead_id=str(lead["id"]),
                subject=subject,
                body_html=body,
                status="pending",
            )
            s.add(email_record)
            created_ids.append(email_record.id)
        await s.commit()

    if session:
        await _create(session)
    else:
        async with db_session() as s:
            await _create(s)

    logger.info("[bs_email] Sequence created | {} emails | campaign={}", len(created_ids), campaign_id)
    return created_ids


async def send_email(email_id: str) -> bool:
    """
    Send a single email record via SMTP.

    Args:
        email_id: Database ID of the Email record to send.

    Returns:
        True on success, False on failure.
    """
    async with db_session() as session:
        result = await session.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one_or_none()
        if not email:
            logger.warning("[bs_email] Email not found | id={}", email_id)
            return False
        recipient_result = await session.execute(select(Lead).where(Lead.id == email.lead_id))
        lead = recipient_result.scalar_one_or_none()
        recipient = lead.email_encrypted if lead else None
        if not recipient:
            logger.warning("[bs_email] No recipient for email_id={}", email_id)
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = email.subject
            msg["From"] = settings.smtp_from
            msg["To"] = recipient
            msg.attach(MIMEText(email.body_html, "html", "utf-8"))
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, recipient, msg.as_string())
            await session.execute(
                update(Email).where(Email.id == email_id).values(status="sent")
            )
            await session.commit()
            logger.info("[bs_email] Email sent | id={}", email_id)
            return True
        except Exception as exc:
            logger.error("[bs_email] Send failed | id={} | {}", email_id, str(exc))
            await session.execute(
                update(Email).where(Email.id == email_id).values(status="failed")
            )
            await session.commit()
            return False


async def track_open(email_id: str) -> None:
    """
    Record an email open event.

    Args:
        email_id: Database ID of the tracked Email.
    """
    async with db_session() as session:
        await session.execute(
            update(Email).where(Email.id == email_id).values(opened=True)
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
    async with db_session() as session:
        await session.execute(
            update(Email).where(Email.id == email_id).values(clicked=True)
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
        await session.commit()
    logger.info("[bs_email] Unsubscribed | lead_id={}", lead_id)
