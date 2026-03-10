# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_audience_insights/best_time_engine.py
# DESCRIPTION  : Optimal posting time recommendations per platform
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Platform = Literal["instagram", "tiktok", "youtube", "x", "linkedin"]

# ---------------------------------------------------------------------------
# Reference data: (day_of_week [0=Mon], hour_utc_range_start, range_end)
# Based on industry benchmarks (CET → UTC offset = -1h in summer / -2h winter)
# We store CET values; callers should convert to local TZ if needed.
# ---------------------------------------------------------------------------
_REFERENCE_SLOTS: dict[str, list[dict]] = {
    "instagram": [
        {"day": "Tuesday",   "window_start": "11:00", "window_end": "13:00", "score": 95},
        {"day": "Wednesday", "window_start": "11:00", "window_end": "13:00", "score": 92},
        {"day": "Thursday",  "window_start": "11:00", "window_end": "13:00", "score": 90},
        {"day": "Tuesday",   "window_start": "17:00", "window_end": "19:00", "score": 87},
        {"day": "Wednesday", "window_start": "17:00", "window_end": "19:00", "score": 85},
        {"day": "Thursday",  "window_start": "17:00", "window_end": "19:00", "score": 83},
    ],
    "tiktok": [
        {"day": "Tuesday",  "window_start": "07:00", "window_end": "09:00", "score": 95},
        {"day": "Thursday", "window_start": "07:00", "window_end": "09:00", "score": 92},
        {"day": "Friday",   "window_start": "07:00", "window_end": "09:00", "score": 90},
        {"day": "Tuesday",  "window_start": "19:00", "window_end": "21:00", "score": 88},
        {"day": "Thursday", "window_start": "19:00", "window_end": "21:00", "score": 85},
        {"day": "Friday",   "window_start": "19:00", "window_end": "21:00", "score": 83},
    ],
    "youtube": [
        {"day": "Friday",   "window_start": "14:00", "window_end": "17:00", "score": 95},
        {"day": "Saturday", "window_start": "14:00", "window_end": "17:00", "score": 93},
        {"day": "Sunday",   "window_start": "14:00", "window_end": "17:00", "score": 90},
        {"day": "Thursday", "window_start": "15:00", "window_end": "17:00", "score": 82},
    ],
    "x": [
        {"day": "Monday",    "window_start": "08:00", "window_end": "10:00", "score": 95},
        {"day": "Wednesday", "window_start": "08:00", "window_end": "10:00", "score": 92},
        {"day": "Monday",    "window_start": "18:00", "window_end": "20:00", "score": 88},
        {"day": "Wednesday", "window_start": "18:00", "window_end": "20:00", "score": 85},
    ],
    "linkedin": [
        {"day": "Tuesday",   "window_start": "08:00", "window_end": "10:00", "score": 95},
        {"day": "Wednesday", "window_start": "08:00", "window_end": "10:00", "score": 92},
        {"day": "Thursday",  "window_start": "08:00", "window_end": "10:00", "score": 90},
        {"day": "Tuesday",   "window_start": "12:00", "window_end": "14:00", "score": 83},
    ],
}

# Heatmap: day -> hour -> relative score (0-100)
_DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _build_heatmap(slots: list[dict]) -> dict[str, dict[int, int]]:
    heatmap: dict[str, dict[int, int]] = {day: {} for day in _DAY_ORDER}
    for slot in slots:
        day = slot["day"]
        start_h = int(slot["window_start"].split(":")[0])
        end_h = int(slot["window_end"].split(":")[0])
        score = slot["score"]
        for h in range(start_h, end_h):
            existing = heatmap[day].get(h, 0)
            heatmap[day][h] = max(existing, score)
    return heatmap


@dataclass
class BestTimeResult:
    platform: str
    top_times: list[dict]
    heatmap: dict[str, dict[int, int]] = field(default_factory=dict)
    confidence: Literal["high", "medium", "low"] = "high"
    note: str = "Based on industry benchmarks (CET timezone). Adjust for target audience timezone."


def get_best_posting_times(
    platform: Platform,
    account_data: dict | None = None,  # reserved for future API-based personalisation
) -> BestTimeResult:
    """
    Return optimal posting windows for a platform.

    Args:
        platform:     Target social platform.
        account_data: Optional account-level data for personalised recommendations.
                      Not yet used; reserved for future implementation.

    Returns:
        BestTimeResult with top_times sorted by score (desc) and a weekly heatmap.
    """
    slots = _REFERENCE_SLOTS.get(platform, [])

    if not slots:
        return BestTimeResult(
            platform=platform,
            top_times=[],
            confidence="low",
            note="Platform not supported yet.",
        )

    confidence: Literal["high", "medium", "low"] = "medium" if account_data else "high"

    top_times = sorted(slots, key=lambda s: s["score"], reverse=True)[:5]
    heatmap = _build_heatmap(slots)

    return BestTimeResult(
        platform=platform,
        top_times=top_times,
        heatmap=heatmap,
        confidence=confidence,
    )
