# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_scoring/rules.py
# Rule-based scoring engine with configurable weights and penalties.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from loguru import logger

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class RuleScore:
    """Result of applying all scoring rules to a lead.

    Attributes:
        total:         Aggregated score after rules + penalties (clamped 0–60).
        applied_rules: Human-readable list of rules that contributed points.
        penalties:     Human-readable list of applied penalties.
    """

    total: int
    applied_rules: list[str] = field(default_factory=list)
    penalties: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# ScoringRules
# ---------------------------------------------------------------------------


class ScoringRules:
    """Applies configurable rule-based scoring to a lead data dictionary.

    The rules bucket contributes up to 60 points. The remaining 40 points
    come from the GPT-4 qualitative analysis in ``bs_scoring/service.py``.

    Default point allocations:
        +15 → email verified (not bounced)
        +10 → opt_in is True
        +10 → first_name AND last_name present
        +10 → source == "api" (active inbound lead)
        + 5 → created within the last 30 days (fresh lead)
        +10 → opened at least 1 email (email_logs engagement)

    Penalties:
        -20 → unsubscribed (opt_in forced to False via RGPD)
        -10 → 3 or more bounced emails recorded

    Example:
        >>> rules = ScoringRules()
        >>> result = rules.apply({"opt_in": True, "email_verified": True})
        >>> result.total
        25
    """

    # Point values — override by subclassing or injecting a config dict
    POINTS_EMAIL_VERIFIED: int = 15
    POINTS_OPT_IN: int = 10
    POINTS_FULL_NAME: int = 10
    POINTS_API_SOURCE: int = 10
    POINTS_FRESH_LEAD: int = 5
    POINTS_EMAIL_ENGAGEMENT: int = 10

    PENALTY_UNSUBSCRIBED: int = 20
    PENALTY_BOUNCED: int = 10
    BOUNCED_THRESHOLD: int = 3
    FRESH_LEAD_DAYS: int = 30

    def apply(self, lead_data: dict[str, Any]) -> RuleScore:
        """Apply all scoring rules to *lead_data* and return a RuleScore.

        The score is clamped between 0 and 60 after all rules and penalties
        have been applied.

        Args:
            lead_data: Dictionary with lead attributes. Expected keys:
                - email_verified (bool, optional)
                - opt_in (bool, optional)
                - first_name (str, optional)
                - last_name (str, optional)
                - source (str, optional) — "api" | "form" | "import" …
                - created_at (str | datetime, optional) — ISO-8601 or datetime
                - email_open_count (int, optional)
                - unsubscribed (bool, optional)
                - bounce_count (int, optional)

        Returns:
            RuleScore with total points and lists of applied rules/penalties.
        """
        score = 0
        applied: list[str] = []
        penalties: list[str] = []

        # ── Positive rules ────────────────────────────────────────────────

        if lead_data.get("email_verified"):
            score += self.POINTS_EMAIL_VERIFIED
            applied.append(f"+{self.POINTS_EMAIL_VERIFIED} email vérifié")

        if lead_data.get("opt_in"):
            score += self.POINTS_OPT_IN
            applied.append(f"+{self.POINTS_OPT_IN} opt-in confirmé")

        if lead_data.get("first_name") and lead_data.get("last_name"):
            score += self.POINTS_FULL_NAME
            applied.append(f"+{self.POINTS_FULL_NAME} profil complet (prénom + nom)")

        if str(lead_data.get("source", "")).lower() == "api":
            score += self.POINTS_API_SOURCE
            applied.append(f"+{self.POINTS_API_SOURCE} source API (entrant actif)")

        if self._is_fresh(lead_data.get("created_at")):
            score += self.POINTS_FRESH_LEAD
            applied.append(
                f"+{self.POINTS_FRESH_LEAD} lead récent (< {self.FRESH_LEAD_DAYS}j)"
            )

        email_opens = int(lead_data.get("email_open_count", 0))
        if email_opens >= 1:
            score += self.POINTS_EMAIL_ENGAGEMENT
            applied.append(
                f"+{self.POINTS_EMAIL_ENGAGEMENT} "
                f"engagement email ({email_opens} ouverture(s))"
            )

        # ── Penalties ─────────────────────────────────────────────────────

        if lead_data.get("unsubscribed") or lead_data.get("opt_in") is False:
            score -= self.PENALTY_UNSUBSCRIBED
            penalties.append(f"-{self.PENALTY_UNSUBSCRIBED} désabonné")

        bounce_count = int(lead_data.get("bounce_count", 0))
        if bounce_count >= self.BOUNCED_THRESHOLD:
            score -= self.PENALTY_BOUNCED
            penalties.append(
                f"-{self.PENALTY_BOUNCED} "
                f"{bounce_count} email(s) bounced (≥ {self.BOUNCED_THRESHOLD})"
            )

        # Clamp to 0–60 (AI adds the remaining 0–40)
        total = max(0, min(60, score))

        logger.debug(
            "[bs_scoring/rules] lead={} raw={} clamped={} rules={} penalties={}",
            lead_data.get("id", "?"),
            score,
            total,
            len(applied),
            len(penalties),
        )

        return RuleScore(total=total, applied_rules=applied, penalties=penalties)

    # ── Private helpers ───────────────────────────────────────────────────

    def _is_fresh(self, created_at: Any) -> bool:
        """Return True if *created_at* is within the last FRESH_LEAD_DAYS days.

        Args:
            created_at: ISO-8601 string, datetime object, or None.

        Returns:
            True if the lead is fresh, False otherwise (including on parse error).
        """
        if created_at is None:
            return False
        try:
            if isinstance(created_at, datetime):
                dt = created_at
            else:
                dt = datetime.fromisoformat(str(created_at))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            age_days = (datetime.now(UTC) - dt).days
            return age_days <= self.FRESH_LEAD_DAYS
        except (ValueError, TypeError) as exc:
            logger.debug(
                "[bs_scoring/rules] Could not parse created_at={} | {}", created_at, exc
            )
            return False
