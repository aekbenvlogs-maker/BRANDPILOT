# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : configs/alerting.py
# DESCRIPTION  : Operational alerting — Slack webhook + email notifications
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from email.mime.text import MIMEText
from typing import Literal

import aiosmtplib
import httpx
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

AlertLevel = Literal["info", "warning", "critical"]

# Slack colour codes per level
_SLACK_COLORS: dict[str, str] = {
    "info":     "#36a64f",   # green
    "warning":  "#ff9f00",   # amber
    "critical": "#d00000",   # red
}

_LEVEL_EMOJI: dict[str, str] = {
    "info":     "ℹ️",
    "warning":  "⚠️",
    "critical": "🚨",
}


async def send_slack_alert(message: str, level: AlertLevel = "warning") -> bool:
    """
    Post an alert message to the configured Slack webhook.

    Args:
        message: Human-readable alert text.
        level:   Severity level — info / warning / critical.

    Returns:
        True if the Slack call succeeded, False otherwise.
    """
    if not settings.slack_webhook_url:
        logger.debug("[alerting] Slack webhook not configured — skipping.")
        return False
    payload = {
        "attachments": [
            {
                "color": _SLACK_COLORS.get(level, "#ff9f00"),
                "title": f"{_LEVEL_EMOJI.get(level, '⚠️')} BRANDSCALE Alert [{level.upper()}]",
                "text": message,
                "footer": f"BRANDSCALE v{settings.app_version} | {settings.app_env}",
            }
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(settings.slack_webhook_url, json=payload)
            resp.raise_for_status()
        logger.info("[alerting] Slack alert sent | level={}", level)
        return True
    except Exception as exc:
        logger.error("[alerting] Slack alert failed | level={} error={}", level, str(exc))
        return False


async def send_email_alert(message: str, level: AlertLevel = "warning") -> bool:
    """
    Send an alert email to the configured alert address via SMTP.

    Args:
        message: Human-readable alert text.
        level:   Severity level — info / warning / critical.

    Returns:
        True if the email was sent, False otherwise.
    """
    if not settings.alert_email:
        logger.debug("[alerting] alert_email not configured — skipping.")
        return False
    subject = (
        f"{_LEVEL_EMOJI.get(level, '⚠️')} [BRANDSCALE {level.upper()}] "
        f"{message[:80]}..."
        if len(message) > 80
        else f"{_LEVEL_EMOJI.get(level, '⚠️')} [BRANDSCALE {level.upper()}] {message}"
    )
    msg = MIMEText(message, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = settings.alert_email
    try:
        async with aiosmtplib.SMTP(
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            use_tls=settings.smtp_use_tls,
        ) as server:
            if settings.smtp_user and settings.smtp_password:
                await server.login(settings.smtp_user, settings.smtp_password)
            await server.send_message(msg)
        logger.info("[alerting] Email alert sent | level={} to={}", level, settings.alert_email)
        return True
    except Exception as exc:
        logger.error("[alerting] Email alert failed | level={} error={}", level, str(exc))
        return False


async def send_alert(message: str, level: AlertLevel = "warning") -> None:
    """
    Dispatch an operational alert to all configured channels (Slack + email).

    This is the single entry-point called throughout the codebase for all
    critical events: budget threshold, API quota breach, SMTP failures,
    Celery retry storms, RGPD purge completions.

    Args:
        message: Human-readable alert description.
        level:   Severity — 'info', 'warning', or 'critical'.
    """
    logger.warning("[alerting] ALERT [{level}] {msg}", level=level.upper(), msg=message)
    await send_slack_alert(message, level)
    if level == "critical":
        # Critical alerts also go to email for guaranteed delivery
        await send_email_alert(message, level)


if __name__ == "__main__":
    import asyncio

    asyncio.run(send_alert("Smoke test — alerting module loaded.", level="info"))
