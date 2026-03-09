# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_email_unsubscribe_rgpd_compliant.py
# DESCRIPTION  : Pytest — RGPD unsubscribe compliance tests
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

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

        session.execute.assert_called()
        assert session.execute.call_count == 2
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
        {"id": "00000000-0000-0000-0000-000000000001", "opt_in": True, "email": "a@test.com", "first_name": "Alice"},
        {"id": "00000000-0000-0000-0000-000000000002", "opt_in": True, "email": "b@test.com", "first_name": "Bob"},
    ]

    with patch("microservices.bs_email.service.db_session") as mock_ctx:
        session = AsyncMock()
        session.add = MagicMock()
        session.add_all = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await create_sequence(
            campaign_data={"id": "00000000-0000-0000-0000-000000000099", "name": "Test", "subject": "Hello"},
            leads=leads,
            template_html="<p>Hello {{first_name}}</p>",
        )

    assert len(result) == 2
    # add_all() est appelé une seule fois avec les 2 records groupés
    session.add_all.assert_called_once()
    assert len(session.add_all.call_args[0][0]) == 2
