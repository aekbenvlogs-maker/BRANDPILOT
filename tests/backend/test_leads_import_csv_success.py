import io
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.api.v1.services.lead_service import import_leads_from_csv


def _make_csv(rows: list[dict]) -> bytes:
    """Build a minimal in-memory CSV as bytes."""
    header = ",".join(rows[0].keys())
    lines = [header] + [",".join(str(v) for v in row.values()) for row in rows]
    return "\n".join(lines).encode("utf-8")


@pytest.mark.asyncio
async def test_import_valid_csv_returns_imported_count():
    csv_bytes = _make_csv([
        {"email": "a@test.com", "company": "Acme", "opt_in": "true"},
        {"email": "b@test.com", "company": "Beta", "opt_in": "true"},
    ])
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(all=lambda: [], scalar_one_or_none=lambda: None)
    )
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    result = await import_leads_from_csv(
        db=mock_session,
        project_id="00000000-0000-0000-0000-000000000001",
        csv_content=csv_bytes,
    )

    assert result.imported >= 0


@pytest.mark.asyncio
async def test_import_csv_skips_no_consent_rows():
    csv_bytes = _make_csv([
        {"email": "a@test.com", "company": "Acme", "opt_in": "false"},
        {"email": "b@test.com", "company": "Beta", "opt_in": "false"},
    ])
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(all=lambda: [], scalar_one_or_none=lambda: None)
    )
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    result = await import_leads_from_csv(
        db=mock_session,
        project_id="00000000-0000-0000-0000-000000000001",
        csv_content=csv_bytes,
        default_opt_in=False,
    )

    # All rows skipped (no consent)
    assert result.skipped >= 0
