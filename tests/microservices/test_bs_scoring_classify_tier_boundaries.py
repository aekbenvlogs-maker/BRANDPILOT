# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_scoring_classify_tier_boundaries.py
# DESCRIPTION  : Pytest — tier classification boundary tests
# ============================================================
from __future__ import annotations

import pytest

from microservices.bs_scoring.service import classify_tier, explain_score


@pytest.mark.parametrize("score,expected", [
    (0,   "cold"),
    (39,  "cold"),
    (40,  "warm"),
    (69,  "warm"),
    (70,  "hot"),
    (100, "hot"),
])
def test_classify_tier_boundaries(score: int, expected: str):
    assert classify_tier(score) == expected


def test_explain_score_returns_all_keys():
    lead = {
        "id": "lead-x",
        "sector": "saas",
        "company_size": "mid-market",
        "source": "inbound",
        "email_opens": 3,
        "email_clicks": 1,
        "page_visits": 2,
    }
    result = explain_score(lead)
    assert "factors" in result
    assert "total_score" in result
    assert "tier" in result
    assert "improvement_hints" in result


def test_explain_score_hints_on_cold_lead():
    lead = {
        "id": "lead-y",
        "sector": "other",
        "company_size": "individual",
        "source": "ads",
        "email_opens": 0,
        "email_clicks": 0,
        "page_visits": 0,
    }
    result = explain_score(lead)
    assert len(result["improvement_hints"]) > 0


def test_explain_score_no_hints_on_hot_lead():
    lead = {
        "id": "lead-z",
        "sector": "saas",
        "company_size": "enterprise",
        "source": "referral",
        "email_opens": 10,
        "email_clicks": 5,
        "page_visits": 10,
    }
    result = explain_score(lead)
    assert result["tier"] == "hot"
