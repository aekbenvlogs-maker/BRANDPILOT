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
    import uuid as _uuid
    from database.models_orm import Email, Lead
    from microservices.bs_email.service import send_email

    _email_id = _uuid.uuid4()
    _lead_id = _uuid.uuid4()

    fake_email = Email(
        id=_email_id,
        campaign_id=_uuid.uuid4(),
        lead_id=_lead_id,
        subject="Test",
        body="<p>Hello</p>",
    )
    fake_lead = Lead(id=_lead_id, email="encrypted-placeholder", opt_in=True)

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

    mock_smtp_instance = MagicMock()
    mock_smtp_instance.__aenter__ = AsyncMock(side_effect=Exception("SMTP failed"))
    mock_smtp_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("microservices.bs_email.service.db_session") as mock_ctx, \
         patch("microservices.bs_email.service.decrypt_pii", return_value="test@example.com"), \
         patch("microservices.bs_email.service.aiosmtplib.SMTP", return_value=mock_smtp_instance):

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=execute_side_effect)
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await send_email(str(_email_id))

    assert result is False
