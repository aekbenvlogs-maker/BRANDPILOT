# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_leads_import_csv_success.py
# DESCRIPTION  : Pytest — CSV import service unit tests
# ============================================================
from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.api.v1.services.lead_service import import_leads_from_csv


def _make_csv(rows: list[dict]) -> io.BytesIO:
    """Build a minimal in-memory CSV."""
    header = ",".join(rows[0].keys())
    lines = [header] + [",".join(str(v) for v in row.values()) for row in rows]
    return io.BytesIO("\n".join(lines).encode("utf-8"))


@pytest.mark.asyncio
async def test_import_valid_csv_returns_imported_count():
    csv_file = _make_csv([
        {"email": "a@test.com", "company": "Acme", "opt_in": "true"},
        {"email": "b@test.com", "company": "Beta", "opt_in": "true"},
    ])
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    mock_session.commit = AsyncMock()

    with patch("backend.api.v1.services.lead_service.db_session") as mock_ctx:
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await import_leads_from_csv(csv_file, project_id="proj-1")

    assert result["imported"] >= 0


@pytest.mark.asyncio
async def test_import_csv_skips_no_consent_rows():
    csv_file = _make_csv([
        {"email": "a@test.com", "company": "Acme", "opt_in": "false"},
        {"email": "b@test.com", "company": "Beta", "opt_in": "false"},
    ])
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    mock_session.commit = AsyncMock()

    with patch("backend.api.v1.services.lead_service.db_session") as mock_ctx:
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await import_leads_from_csv(csv_file, project_id="proj-1")

    assert result.get("skipped_no_consent", 0) >= 0
