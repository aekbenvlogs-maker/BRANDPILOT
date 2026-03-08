# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_workflows_run_success.py
# DESCRIPTION  : Pytest — workflow pipeline orchestration tests
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from microservices.workflow import run_feedback_loop, run_lead_pipeline


@pytest.mark.asyncio
async def test_run_lead_pipeline_returns_job_id():
    leads = [
        {"id": "lead-1", "sector": "saas", "company_size": "smb", "source": "inbound"},
        {"id": "lead-2", "sector": "fintech", "company_size": "mid-market", "source": "referral"},
    ]

    with patch("microservices.workflow.db_session") as mock_ctx, \
         patch("microservices.workflow.task_score_lead") as mock_score, \
         patch("microservices.workflow.task_rank_leads") as mock_rank, \
         patch("microservices.workflow.group") as mock_group, \
         patch("microservices.workflow.chain") as mock_chain:

        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_chain.return_value.apply_async = MagicMock()

        job_id = await run_lead_pipeline(leads, campaign_id="campaign-1")

    assert isinstance(job_id, str)
    assert len(job_id) == 36  # UUID length


@pytest.mark.asyncio
async def test_run_feedback_loop_high_conversion():
    kpis = {"open_rate": 0.40, "click_rate": 0.10, "conversion_rate": 0.06}

    with patch("microservices.workflow.db_session") as mock_ctx:
        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.execute = AsyncMock()
        mock_ctx.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        job_id = await run_feedback_loop("campaign-1", kpis)

    assert isinstance(job_id, str)
