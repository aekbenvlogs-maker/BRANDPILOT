# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/services/lead_service.py
# DESCRIPTION  : Business logic for Lead CRUD, CSV import, and PII encryption
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, MultiFernet
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.lead import LeadCreate, LeadImportResponse, LeadUpdate
from configs.settings import get_settings
from database.models_orm import Lead, ScoreTier

settings = get_settings()

# ---------------------------------------------------------------------------
# Fernet encryption for PII fields
# ---------------------------------------------------------------------------
def _get_fernet() -> MultiFernet:
    """
    Build a MultiFernet instance supporting key rotation.

    The primary key is FERNET_KEY. If FERNET_KEY_PREVIOUS is set (non-empty),
    it is added as a decryption fallback so that data encrypted with the old
    key can still be read during rotation, without any downtime.
    """
    keys = [Fernet(settings.fernet_key.encode())]
    if settings.fernet_key_previous:
        keys.append(Fernet(settings.fernet_key_previous.encode()))
    return MultiFernet(keys)


_fernet = _get_fernet()


def encrypt_pii(value: Optional[str]) -> Optional[str]:
    """Encrypt a PII string with Fernet symmetric encryption."""
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt_pii(value: Optional[str]) -> Optional[str]:
    """Decrypt a Fernet-encrypted PII string."""
    if value is None:
        return None
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        logger.error("[BRANDSCALE] PII decryption failed — data may be corrupt.")
        return None


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------
async def create_lead(db: AsyncSession, data: LeadCreate) -> Lead:
    """
    Create a lead with PII fields encrypted at rest.

    Args:
        db:   Async database session.
        data: Validated lead creation payload.

    Returns:
        Newly created Lead ORM instance.
    """
    lead = Lead(
        project_id=data.project_id,
        email=encrypt_pii(data.email) or "",
        first_name=encrypt_pii(data.first_name),
        last_name=encrypt_pii(data.last_name),
        company=data.company,
        sector=data.sector,
        source=data.source,
        opt_in=data.opt_in,
        consent_date=data.consent_date,
        consent_source=data.consent_source,
    )
    db.add(lead)
    await db.flush()
    await db.refresh(lead)
    logger.info("[BRANDSCALE] Lead created | id={}", lead.id)
    return lead


async def list_leads(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    tier_filter: Optional[ScoreTier] = None,
    sector_filter: Optional[str] = None,
) -> tuple[list[Lead], int]:
    """Return paginated leads for a project with optional filters."""
    base_query = select(Lead).where(Lead.project_id == project_id)
    if tier_filter is not None:
        base_query = base_query.where(Lead.score_tier == tier_filter)
    if sector_filter:
        base_query = base_query.where(Lead.sector == sector_filter)

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(Lead.score.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_lead(
    db: AsyncSession, lead_id: uuid.UUID
) -> Optional[Lead]:
    """Fetch a single lead by ID."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    return result.scalar_one_or_none()


async def update_lead(
    db: AsyncSession, lead: Lead, data: LeadUpdate
) -> Lead:
    """Apply partial updates to a lead, encrypting PII fields."""
    update_data = data.model_dump(exclude_unset=True)

    # Re-encrypt PII fields if they are being updated
    pii_fields = {"email", "first_name", "last_name"}
    for field, value in update_data.items():
        if field in pii_fields and value is not None:
            setattr(lead, field, encrypt_pii(value))
        else:
            setattr(lead, field, value)

    await db.flush()
    await db.refresh(lead)
    logger.info("[BRANDSCALE] Lead updated | id={}", lead.id)
    return lead


async def delete_lead(db: AsyncSession, lead: Lead) -> None:
    """RGPD: permanently delete a lead and all associated data."""
    await db.delete(lead)
    await db.flush()
    logger.info("[BRANDSCALE] Lead deleted (RGPD) | id={}", lead.id)


async def update_lead_score(
    db: AsyncSession,
    lead: Lead,
    score: int,
    tier: ScoreTier,
) -> Lead:
    """
    Update the AI score and tier for a lead.

    Args:
        db:    Async database session.
        lead:  Lead ORM object.
        score: New numeric score (0-100).
        tier:  Derived tier (hot/warm/cold).

    Returns:
        Updated Lead instance.
    """
    lead.score = score
    lead.score_tier = tier
    lead.score_updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(lead)
    return lead


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------
async def import_leads_from_csv(
    db: AsyncSession,
    project_id: uuid.UUID,
    csv_content: bytes,
    default_opt_in: bool = False,
) -> LeadImportResponse:
    """
    Bulk import leads from CSV bytes.

    Expected CSV columns (header row required):
        email, first_name, last_name, company, sector, source, opt_in

    Args:
        db:             Async database session.
        project_id:     Target project UUID.
        csv_content:    Raw CSV file bytes.
        default_opt_in: Fallback opt_in value if column missing.

    Returns:
        LeadImportResponse with counts and error list.
    """
    imported = 0
    skipped = 0
    errors: list[str] = []

    try:
        reader = csv.DictReader(io.StringIO(csv_content.decode("utf-8-sig")))
        rows = list(reader)
    except Exception as exc:
        return LeadImportResponse(
            imported=0,
            skipped=0,
            errors=[f"CSV parse error: {exc}"],
            total_processed=0,
        )

    # Pre-fetch all existing encrypted emails for this project once — O(n) total
    existing_enc_result = await db.execute(
        select(Lead.email).where(Lead.project_id == project_id)
    )
    existing_emails_plain: set[str] = {
        plain.lower()
        for enc in (row[0] for row in existing_enc_result.all())
        if (plain := decrypt_pii(enc)) is not None
    }

    for idx, row in enumerate(rows, start=2):  # row 1 is header
        email = (row.get("email") or "").strip()
        if not email:
            errors.append(f"Row {idx}: missing email — skipped")
            skipped += 1
            continue

        if email.lower() in existing_emails_plain:
            skipped += 1
            continue

        opt_in_raw = (row.get("opt_in") or "").strip().lower()
        opt_in = default_opt_in if not opt_in_raw else opt_in_raw in ("1", "true", "yes", "oui")

        lead = Lead(
            project_id=project_id,
            email=encrypt_pii(email) or "",
            first_name=encrypt_pii(row.get("first_name", "").strip() or None),
            last_name=encrypt_pii(row.get("last_name", "").strip() or None),
            company=row.get("company", "").strip() or None,
            sector=row.get("sector", "").strip() or None,
            source=row.get("source", "csv_import").strip() or "csv_import",
            opt_in=opt_in,
        )
        db.add(lead)
        existing_emails_plain.add(email.lower())  # prevent intra-batch duplicates
        imported += 1

    await db.flush()
    logger.info(
        "[BRANDSCALE] CSV import | project={} imported={} skipped={}",
        project_id, imported, skipped,
    )
    return LeadImportResponse(
        imported=imported,
        skipped=skipped,
        errors=errors,
        total_processed=len(rows),
    )


if __name__ == "__main__":
    print("[BRANDSCALE] lead_service.py loaded")
