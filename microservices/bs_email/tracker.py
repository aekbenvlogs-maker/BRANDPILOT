# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_email/tracker.py
# Open & click tracking for outbound emails.
# Uses signed URL tokens (itsdangerous) to avoid enumeration attacks.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import base64
import struct
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

from fastapi.responses import RedirectResponse, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from loguru import logger
from sqlalchemy import select, update

from configs.settings import get_settings
from database.connection import db_session
from database.models_orm import Email

settings = get_settings()

# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

_OPEN_SALT = "brandscale-open-tracking"
_CLICK_SALT = "brandscale-click-tracking"
_TOKEN_MAX_AGE = 7 * 24 * 3600  # 7 days

_serializer = URLSafeTimedSerializer(
    settings.secret_key,  # type: ignore[attr-defined]
    signer_kwargs={"key_derivation": "hmac"},
)

# ---------------------------------------------------------------------------
# 1 × 1 transparent GIF payload (43 bytes)
# ---------------------------------------------------------------------------

# fmt: off
_PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)
# fmt: on

# ---------------------------------------------------------------------------
# Base URL for tracker endpoints (e.g. "https://api.brandscale.ai")
# ---------------------------------------------------------------------------

_API_BASE: str = getattr(settings, "api_base_url", "https://api.brandscale.ai")


# ---------------------------------------------------------------------------
# Open tracking
# ---------------------------------------------------------------------------


def generate_tracking_pixel(email_log_id: str) -> str:
    """Generate a URL that serves a 1×1 pixel and records an email open.

    The token encodes ``{"email_log_id": "<uuid>"}`` using a signed,
    timed serializer so the ID is never exposed in the URL.

    Args:
        email_log_id: UUID of the :class:`Email` row to update on open.

    Returns:
        Absolute URL, e.g.
        ``https://api.brandscale.ai/track/open?t=<token>``
    """
    token = _serializer.dumps({"email_log_id": email_log_id}, salt=_OPEN_SALT)
    qs = urlencode({"t": token})
    return f"{_API_BASE}/track/open?{qs}"


async def record_open(token: str) -> Response:
    """Update the :class:`Email` row when a tracking pixel is loaded.

    Should be wired to ``GET /track/open?t=<token>`` in the FastAPI app.

    Always returns the 1×1 transparent GIF regardless of token validity so
    that email clients never display a broken image.

    Args:
        token: Signed token from :func:`generate_tracking_pixel`.

    Returns:
        :class:`fastapi.responses.Response` with ``image/gif`` content.
    """
    try:
        payload: dict[str, str] = _serializer.loads(
            token,
            salt=_OPEN_SALT,
            max_age=_TOKEN_MAX_AGE,
        )
        email_log_id = payload.get("email_log_id")
        if email_log_id:
            await _mark_opened(email_log_id)
    except (SignatureExpired, BadSignature) as exc:
        logger.debug("[tracker] Open token invalid | reason={}", exc)
    except Exception as exc:  # noqa: BLE001
        logger.error("[tracker] record_open error | {}", exc)

    return Response(
        content=_PIXEL_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


async def _mark_opened(email_log_id: str) -> None:
    """Set ``Email.opened_at`` once (idempotent)."""
    async with db_session() as session:
        result = await session.execute(
            select(Email).where(Email.id == email_log_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            logger.warning("[tracker] Email log not found | id={}", email_log_id)
            return
        if row.opened_at is None:  # type: ignore[attr-defined]
            row.opened_at = datetime.now(tz=timezone.utc)  # type: ignore[attr-defined]
            await session.commit()
            logger.info("[tracker] Open recorded | email_log_id={}", email_log_id)


# ---------------------------------------------------------------------------
# Click tracking
# ---------------------------------------------------------------------------


def generate_tracked_link(url: str, email_log_id: str) -> str:
    """Wrap a CTA URL so that clicks are recorded before the redirect.

    The token encodes ``{"email_log_id": "<uuid>", "url": "<destination>"}``
    so the destination is authenticated and cannot be tampered with.

    Args:
        url:           Destination URL (https://…).
        email_log_id:  UUID of the :class:`Email` row to update on click.

    Returns:
        Absolute redirect URL, e.g.
        ``https://api.brandscale.ai/track/click?t=<token>``
    """
    token = _serializer.dumps(
        {"email_log_id": email_log_id, "url": url},
        salt=_CLICK_SALT,
    )
    qs = urlencode({"t": token})
    return f"{_API_BASE}/track/click?{qs}"


async def record_click(token: str) -> Response:
    """Record a click and redirect to the destination URL.

    Should be wired to ``GET /track/click?t=<token>`` in the FastAPI app.

    If the token is expired or invalid the user is redirected to the
    BRANDPILOT homepage as a safe fallback.

    Args:
        token: Signed token from :func:`generate_tracked_link`.

    Returns:
        :class:`fastapi.responses.RedirectResponse` (HTTP 302).
    """
    fallback_url = f"{_API_BASE.rstrip('/')}/404"

    try:
        payload: dict[str, str] = _serializer.loads(
            token,
            salt=_CLICK_SALT,
            max_age=_TOKEN_MAX_AGE,
        )
        email_log_id = payload.get("email_log_id")
        destination = payload.get("url", fallback_url)

        if email_log_id:
            await _mark_clicked(email_log_id)

        return RedirectResponse(url=destination, status_code=302)

    except SignatureExpired:
        logger.warning("[tracker] Click token expired")
        return RedirectResponse(url=fallback_url, status_code=302)
    except BadSignature:
        logger.warning("[tracker] Click token invalid signature")
        return RedirectResponse(url=fallback_url, status_code=302)
    except Exception as exc:  # noqa: BLE001
        logger.error("[tracker] record_click error | {}", exc)
        return RedirectResponse(url=fallback_url, status_code=302)


async def _mark_clicked(email_log_id: str) -> None:
    """Set ``Email.clicked_at`` once (idempotent)."""
    async with db_session() as session:
        result = await session.execute(
            select(Email).where(Email.id == email_log_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            logger.warning("[tracker] Email log not found | id={}", email_log_id)
            return
        if row.clicked_at is None:  # type: ignore[attr-defined]
            row.clicked_at = datetime.now(tz=timezone.utc)  # type: ignore[attr-defined]
            await session.commit()
            logger.info("[tracker] Click recorded | email_log_id={}", email_log_id)
