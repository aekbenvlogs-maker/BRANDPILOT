# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_email_send_success.py
# DESCRIPTION  : Pytest — email send service happy-path
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_send_email_returns_false_when_not_found():
    from microservices.bs_email.service import send_email

    with patch("microservices.bs_email.service.db_session") as mock_ctx:
        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(return_value=result_mock)
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_email("non-existent-id")

    assert result is False


@pytest.mark.asyncio
async def test_send_email_smtp_failure_returns_false():
    from database.models_orm import Email, Lead
    from microservices.bs_email.service import send_email

    fake_email = Email(
        id="email-1",
        campaign_id="camp-1",
        lead_id="lead-1",
        subject="Test",
        body_html="<p>Hello</p>",
        status="pending",
    )
    fake_lead = Lead(id="lead-1", email_encrypted="test@example.com", opt_in=True)

    call_count = 0

    def execute_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.scalar_one_or_none.return_value = fake_email
        else:
            mock_result.scalar_one_or_none.return_value = fake_lead
        return mock_result

    with patch("microservices.bs_email.service.db_session") as mock_ctx, \
         patch("microservices.bs_email.service.smtplib.SMTP", side_effect=Exception("SMTP failed")):

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=execute_side_effect)
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_email("email-1")

    assert result is False
