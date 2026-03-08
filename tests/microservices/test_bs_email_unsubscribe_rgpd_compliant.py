# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_email_unsubscribe_rgpd_compliant.py
# DESCRIPTION  : Pytest — RGPD unsubscribe compliance tests
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_unsubscribe_calls_db_update():
    from microservices.bs_email.service import unsubscribe

    with patch("microservices.bs_email.service.db_session") as mock_ctx:
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        await unsubscribe("lead-1")

        session.execute.assert_called_once()
        session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_create_sequence_skips_no_consent_leads():
    from microservices.bs_email.service import create_sequence

    leads = [
        {"id": "l-1", "opt_in": False, "email": "a@test.com"},
        {"id": "l-2", "opt_in": False, "email": "b@test.com"},
    ]

    with patch("microservices.bs_email.service.db_session") as mock_ctx:
        session = AsyncMock()
        session.add = AsyncMock()
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await create_sequence(
            campaign_data={"id": "camp-1", "name": "Test", "subject": "Hi"},
            leads=leads,
            template_html="<p>Hello {{first_name}}</p>",
        )

    # No opted-in leads → zero emails created
    assert result == []
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_sequence_creates_emails_for_opted_in():
    from microservices.bs_email.service import create_sequence

    leads = [
        {"id": "l-1", "opt_in": True, "email": "a@test.com", "first_name": "Alice"},
        {"id": "l-2", "opt_in": True, "email": "b@test.com", "first_name": "Bob"},
    ]

    with patch("microservices.bs_email.service.db_session") as mock_ctx:
        session = AsyncMock()
        session.add = AsyncMock()
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await create_sequence(
            campaign_data={"id": "camp-2", "name": "Test", "subject": "Hello"},
            leads=leads,
            template_html="<p>Hello {{first_name}}</p>",
        )

    assert len(result) == 2
    assert session.add.call_count == 2
