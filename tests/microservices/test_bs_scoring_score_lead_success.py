# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_scoring_score_lead_success.py
# DESCRIPTION  : Pytest — bs_scoring score_lead happy-path
# ============================================================
from __future__ import annotations

import pytest

from microservices.bs_scoring.service import score_lead


def test_score_lead_returns_integer():
    lead = {
        "id": "lead-1",
        "sector": "saas",
        "company_size": "mid-market",
        "source": "inbound",
        "email_opens": 5,
        "email_clicks": 2,
        "page_visits": 4,
    }
    result = score_lead(lead)
    assert isinstance(result, int)


def test_score_lead_in_range_0_100():
    lead = {
        "id": "lead-2",
        "sector": "fintech",
        "company_size": "enterprise",
        "source": "referral",
        "email_opens": 10,
        "email_clicks": 5,
        "page_visits": 10,
    }
    result = score_lead(lead)
    assert 0 <= result <= 100


def test_score_high_quality_lead_above_70():
    lead = {
        "id": "lead-3",
        "sector": "saas",
        "company_size": "enterprise",
        "source": "referral",
        "email_opens": 10,
        "email_clicks": 5,
        "page_visits": 10,
    }
    result = score_lead(lead)
    assert result >= 70


def test_score_cold_lead_below_40():
    lead = {
        "id": "lead-4",
        "sector": "other",
        "company_size": "individual",
        "source": "ads",
        "email_opens": 0,
        "email_clicks": 0,
        "page_visits": 0,
    }
    result = score_lead(lead)
    assert result < 60
