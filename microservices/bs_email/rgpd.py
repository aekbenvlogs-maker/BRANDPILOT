# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_email/rgpd.py
# RGPD / GDPR compliance helpers.
# Covers: unsubscribe (Art. 7), right to erasure (Art. 17),
#         data portability (Art. 20), log retention (90-day policy).
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from loguru import logger
from sqlalchemy import delete, func, select, update

from configs.settings import get_settings
from database.connection import db_session
from database.crypto import decrypt_pii
from database.models_orm import Campaign, Email, Lead, User

settings = get_settings()

# itsdangerous serializer — same salt as the unsubscribe link generator
_UNSUB_SALT = "brandpilot-unsubscribe"
_RESET_SALT = "brandpilot-password-reset"
_TOKEN_MAX_AGE = 86_400  # 24 h

_serializer = URLSafeTimedSerializer(
    settings.secret_key,  # type: ignore[attr-defined]
    signer_kwargs={"key_derivation": "hmac"},
)

# ---------------------------------------------------------------------------
# Unsubscribe
# ---------------------------------------------------------------------------


async def process_unsubscribe(token: str) -> bool:
    """Verify a RGPD unsubscribe token and mark the lead as opted-out.

    This implements GDPR Article 7 (withdrawal of consent).

    The *token* is an itsdangerous URLSafeTimedSerializer payload that
    encodes ``{"lead_id": "<uuid>", "email": "<hashed>"}``.  Tokens expire
    after 24 hours.

    Side-effects:
    - Sets ``lead.opt_in = False`` and ``lead.opted_out_at = now()`` in DB.
    - Writes an audit-log record (JSON) so the withdrawal is traceable.
    - Cancels any pending :class:`Email` rows for the lead.

    Args:
        token: Signed, timed token from the unsubscribe URL.

    Returns:
        ``True`` on success, ``False`` if token is invalid / expired.
    """
    try:
        payload: dict[str, str] = _serializer.loads(
            token,
            salt=_UNSUB_SALT,
            max_age=_TOKEN_MAX_AGE,
        )
    except SignatureExpired:
        logger.warning("[rgpd] Unsubscribe token expired")
        return False
    except BadSignature:
        logger.warning("[rgpd] Unsubscribe token invalid signature")
        return False

    lead_id = payload.get("lead_id")
    if not lead_id:
        logger.error("[rgpd] Unsubscribe token missing lead_id")
        return False

    async with db_session() as session:
        result = await session.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()
        if lead is None:
            logger.warning("[rgpd] Lead not found for unsubscribe | lead_id={}", lead_id)
            return False

        if not lead.opt_in:
            logger.info("[rgpd] Lead already opted out | lead_id={}", lead_id)
            return True

        # Art. 7 — withdraw consent
        lead.opt_in = False
        lead.opted_out_at = datetime.now(tz=timezone.utc)  # type: ignore[attr-defined]
        _write_audit_log(session, "unsubscribe", lead_id)

        # Mark unsent emails for this lead as unsubscribed (Email.sent_at IS NULL)
        await session.execute(
            update(Email)
            .where(
                Email.lead_id == lead_id,  # type: ignore[arg-type]
                Email.sent_at.is_(None),  # type: ignore[union-attr]
            )
            .values(unsubscribed=True)
        )
        await session.commit()
        logger.info("[rgpd] Lead unsubscribed | lead_id={}", lead_id)

    return True


def generate_unsubscribe_token(lead_id: str) -> str:
    """Create a signed, time-limited unsubscribe token.

    Args:
        lead_id: UUID of the lead.

    Returns:
        URL-safe signed token string (max age: 24 h).
    """
    return _serializer.dumps({"lead_id": lead_id}, salt=_UNSUB_SALT)  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Log retention (90-day policy)
# ---------------------------------------------------------------------------


async def purge_old_email_logs(retention_days: int = 90) -> int:
    """Delete :class:`Email` rows older than *retention_days* days.

    This satisfies the 90-day retention policy defined in the BRANDPILOT
    privacy policy (GDPR Art. 5 § 1e — storage limitation).

    Args:
        retention_days: Number of days to keep email logs (default: 90).

    Returns:
        Number of rows deleted.
    """
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=retention_days)

    async with db_session() as session:
        result = await session.execute(
            delete(Email)
            .where(Email.created_at < cutoff)  # type: ignore[attr-defined]
            .returning(Email.id)
        )
        deleted = len(result.fetchall())
        await session.commit()

    logger.info(
        "[rgpd] Email log purge complete | cutoff={} deleted={}",
        cutoff.date(),
        deleted,
    )
    return deleted


# ---------------------------------------------------------------------------
# Data portability — Art. 20
# ---------------------------------------------------------------------------


async def export_user_data(user_id: str) -> dict[str, Any]:
    """Export all personal data for a user (GDPR Article 20 portability).

    Collects and decrypts PII from :class:`User`, associated :class:`Lead`
    rows, and :class:`Email` history.  The returned dict is safe to
    serialize to JSON and hand back to the data subject.

    Args:
        user_id: UUID of the :class:`User`.

    Returns:
        ``{"user": {...}, "leads": [...], "emails": [...]}``

    Raises:
        ValueError: If the user cannot be found.
    """
    async with db_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError(f"User '{user_id}' not found")

        # Decrypt encrypted PII fields where present
        user_data: dict[str, Any] = {
            "id": str(user.id),
            "email": _safe_decrypt(getattr(user, "email", None)),
            "first_name": _safe_decrypt(getattr(user, "first_name", None)),
            "last_name": _safe_decrypt(getattr(user, "last_name", None)),
            "created_at": _fmt_dt(getattr(user, "created_at", None)),
            "last_login": _fmt_dt(getattr(user, "last_login", None)),
        }

        # Leads associated with this user's projects
        leads_result = await session.execute(
            select(Lead).where(Lead.user_id == user_id)  # type: ignore[attr-defined]
        )
        leads_rows = leads_result.scalars().all()
        leads_data = [
            {
                "id": str(lead.id),
                "email": _safe_decrypt(getattr(lead, "email", None)),
                "first_name": _safe_decrypt(getattr(lead, "first_name", None)),
                "last_name": _safe_decrypt(getattr(lead, "last_name", None)),
                "opt_in": lead.opt_in,
                "score": getattr(lead, "score", None),
                "tier": getattr(lead, "tier", None),
                "source": getattr(lead, "source", None),
                "created_at": _fmt_dt(getattr(lead, "created_at", None)),
            }
            for lead in leads_rows
        ]

        # Email history
        email_result = await session.execute(
            select(Email).where(Email.user_id == user_id)  # type: ignore[attr-defined]
        )
        email_rows = email_result.scalars().all()
        emails_data = [
            {
                "id": str(e.id),
                "subject": getattr(e, "subject", None),
                "status": getattr(e, "status", None),
                "opened_at": _fmt_dt(getattr(e, "opened_at", None)),
                "clicked_at": _fmt_dt(getattr(e, "clicked_at", None)),
                "created_at": _fmt_dt(getattr(e, "created_at", None)),
            }
            for e in email_rows
        ]

    logger.info("[rgpd] Data export complete | user_id={}", user_id)
    return {"user": user_data, "leads": leads_data, "emails": emails_data}


# ---------------------------------------------------------------------------
# Right to erasure — Art. 17
# ---------------------------------------------------------------------------


async def delete_user_data(user_id: str) -> bool:
    """Erase all personal data for a user (GDPR Article 17 right to erasure).

    Cascade-deletes or anonymizes:
    - PII fields on associated :class:`Lead` rows (pseudonymisation)
    - :class:`Email` rows for those leads
    - The :class:`User` record itself

    An irreversible **audit-log** entry is written *before* deletion so
    that the erasure event is traceable to the DPO.

    Args:
        user_id: UUID of the :class:`User` requesting erasure.

    Returns:
        ``True`` on success, ``False`` if the user was not found.
    """
    async with db_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            logger.warning("[rgpd] delete_user_data — user not found | user_id={}", user_id)
            return False

        # --- Write audit log BEFORE deletion ---
        _write_audit_log(session, "erasure_request", user_id)
        await session.flush()  # ensure audit row is persisted first

        # 1. Anonymise leads (keep statistical record, remove PII)
        await session.execute(
            update(Lead)
            .where(Lead.user_id == user_id)  # type: ignore[attr-defined]
            .values(
                email=None,
                first_name=None,
                last_name=None,
                phone=None,
                opt_in=False,
                anonymised=True,
                anonymised_at=datetime.now(tz=timezone.utc),
            )
        )

        # 2. Delete email logs for this user's leads
        await session.execute(
            delete(Email).where(Email.user_id == user_id)  # type: ignore[attr-defined]
        )

        # 3. Delete the user record
        await session.delete(user)
        await session.commit()

    logger.info("[rgpd] User data erased | user_id={}", user_id)
    return True


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _safe_decrypt(value: str | None) -> str | None:
    """Attempt PII decryption, return ``None`` on failure."""
    if value is None:
        return None
    try:
        return decrypt_pii(value)
    except Exception:  # noqa: BLE001
        return value  # already plaintext or unrecognised format


def _fmt_dt(dt: datetime | None) -> str | None:
    """Format a datetime to ISO-8601 string, or return ``None``."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _write_audit_log(session: Any, action: str, subject_id: str) -> None:
    """Append a JSON audit record to the session (does NOT commit).

    The audit table is expected to have columns:
    ``id``, ``action``, ``subject_id``, ``details``, ``created_at``.

    If the model is unavailable this is a no-op (graceful degradation).
    """
    try:
        from database.models_orm import AuditLog  # lazy import — optional model

        entry = AuditLog(
            action=action,
            subject_id=subject_id,
            details=json.dumps(
                {
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                    "service": "bs_email.rgpd",
                }
            ),
            created_at=datetime.now(tz=timezone.utc),
        )
        session.add(entry)
    except (ImportError, Exception) as exc:  # noqa: BLE001
        logger.warning("[rgpd] audit_log write skipped | reason={}", exc)
