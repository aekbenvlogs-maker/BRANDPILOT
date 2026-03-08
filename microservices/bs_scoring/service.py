# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_scoring/service.py
# DESCRIPTION  : Lead scoring, ranking, tier classification, explanation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Any

from loguru import logger

# Scoring weights (must sum to 1.0)
_WEIGHTS: dict[str, float] = {
    "sector": 0.25,
    "company_size": 0.20,
    "engagement": 0.35,
    "source": 0.20,
}

# Sector importance mapping (B2B focus)
_SECTOR_SCORES: dict[str, int] = {
    "saas": 100,
    "fintech": 90,
    "healthtech": 85,
    "e-commerce": 80,
    "consulting": 70,
    "retail": 60,
    "other": 40,
}

# Company size tiers
_SIZE_SCORES: dict[str, int] = {
    "enterprise": 100,
    "mid-market": 80,
    "smb": 60,
    "startup": 40,
    "individual": 20,
}

# Lead acquisition source quality
_SOURCE_SCORES: dict[str, int] = {
    "referral": 100,
    "inbound": 85,
    "linkedin": 75,
    "webinar": 70,
    "cold_outreach": 50,
    "ads": 40,
    "other": 30,
}


def _score_sector(lead: dict[str, Any]) -> int:
    """Return sector quality score 0-100."""
    sector = str(lead.get("sector", "other")).lower()
    return _SECTOR_SCORES.get(sector, 40)


def _score_company_size(lead: dict[str, Any]) -> int:
    """Return company-size quality score 0-100."""
    size = str(lead.get("company_size", "other")).lower()
    return _SIZE_SCORES.get(size, 40)


def _score_engagement(lead: dict[str, Any]) -> int:
    """Return engagement score based on email opens, clicks, and page visits."""
    opens = min(int(lead.get("email_opens", 0)), 10)
    clicks = min(int(lead.get("email_clicks", 0)), 5)
    visits = min(int(lead.get("page_visits", 0)), 10)
    raw = opens * 4 + clicks * 8 + visits * 3
    return min(raw, 100)


def _score_source(lead: dict[str, Any]) -> int:
    """Return source quality score 0-100."""
    source = str(lead.get("source", "other")).lower()
    return _SOURCE_SCORES.get(source, 30)


def score_lead(lead: dict[str, Any]) -> int:
    """
    Compute a composite lead quality score from 0 to 100.

    Args:
        lead: Lead dict with sector, company_size, engagement stats, source.

    Returns:
        Integer score 0-100.
    """
    breakdown: dict[str, int] = {
        "sector": _score_sector(lead),
        "company_size": _score_company_size(lead),
        "engagement": _score_engagement(lead),
        "source": _score_source(lead),
    }
    weighted = sum(breakdown[k] * _WEIGHTS[k] for k in breakdown)
    final_score = round(weighted)
    logger.debug("[bs_scoring] score_lead | lead_id={} | score={}", lead.get("id"), final_score)
    return final_score


def rank_leads(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Sort a list of leads by descending score.

    Args:
        leads: List of lead dicts (each will be scored if missing 'score').

    Returns:
        Sorted list with 'score' field injected.
    """
    scored = []
    for lead in leads:
        lead_copy = dict(lead)
        if "score" not in lead_copy:
            lead_copy["score"] = score_lead(lead_copy)
        scored.append(lead_copy)
    scored.sort(key=lambda l: l["score"], reverse=True)
    logger.info("[bs_scoring] rank_leads | {} leads ranked", len(scored))
    return scored


def classify_tier(score: int) -> str:
    """
    Map a numeric score to a named tier.

    Args:
        score: Integer 0-100.

    Returns:
        "hot", "warm", or "cold".
    """
    if score >= 70:
        return "hot"
    if score >= 40:
        return "warm"
    return "cold"


def explain_score(lead: dict[str, Any]) -> dict[str, Any]:
    """
    Return a detailed factor breakdown for a lead's score.

    Args:
        lead: Lead dict with scoring input fields.

    Returns:
        Dict with factor scores, weights, final score, tier, and improvement hints.
    """
    factors = {
        "sector": _score_sector(lead),
        "company_size": _score_company_size(lead),
        "engagement": _score_engagement(lead),
        "source": _score_source(lead),
    }
    weighted = {k: round(factors[k] * _WEIGHTS[k], 2) for k in factors}
    total = round(sum(weighted.values()))
    tier = classify_tier(total)
    hints: list[str] = []
    if factors["engagement"] < 50:
        hints.append("Increase engagement: send targeted content or invite to webinar.")
    if factors["sector"] < 60:
        hints.append("Focus on higher-value sectors (SaaS, FinTech, HealthTech).")
    if factors["source"] < 50:
        hints.append("Prioritise referral and inbound lead sources.")
    return {
        "lead_id": lead.get("id"),
        "factors": factors,
        "weights": _WEIGHTS,
        "weighted_contribution": weighted,
        "total_score": total,
        "tier": tier,
        "improvement_hints": hints,
        "warning": (
            "Partial score — missing fields: "
            + ", ".join(
                f
                for f, v in [
                    ("company_size", lead.get("company_size")),
                    ("email_opens", lead.get("email_opens", 0)),
                ]
                if not v
            )
        )
        if not lead.get("company_size")
        or (lead.get("email_opens", 0) == 0 and lead.get("email_clicks", 0) == 0)
        else None,
    }
