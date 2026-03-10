# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/campaign_agent/execution_planner.py
# DESCRIPTION  : ExecutionPlanner — maps CampaignIntent to a microservice
#                routing plan (which services to invoke, in what order,
#                and which tasks can run in parallel).
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================
"""
ExecutionPlanner: Step 3 of the Campaign Agent pipeline.

Responsibilities:
  1. Accept a CampaignIntent and BrandContext.
  2. Select which microservices need to be invoked based on the intent.
  3. Return an ExecutionPlan specifying:
       - ordered list of microservice names
       - subset of tasks safe to parallelise in the Celery chord header
       - estimated wall-clock duration (for UX progress bar)

Design principles:
  - Pure function — no DB or network I/O.
  - Deterministic — same intent always produces same plan.
  - Extensible — add new microservices by extending the platform/goal maps.
"""

from __future__ import annotations

from typing import Final

from loguru import logger

from microservices.campaign_agent.agent import BrandContext, ExecutionPlan
from microservices.campaign_agent.intent_parser import CampaignIntent

# ---------------------------------------------------------------------------
# Microservice registry
# ---------------------------------------------------------------------------

#: Core services always included in every campaign plan.
_CORE_SERVICES: Final[list[str]] = [
    "bs_ai_text",       # Caption / copy generation
    "bs_ai_image",      # Visual asset generation
    "bs_scheduling",    # Post scheduling & ETA task dispatch
]

#: Services added when a video platform is targeted.
_VIDEO_PLATFORMS: Final[frozenset[str]] = frozenset(
    {"tiktok", "youtube", "reels", "instagram_reels"}
)

#: Services added when an influencer budget is present.
_INFLUENCER_SERVICE: Final[str] = "bs_influencer_match"

#: Services added when paid ads objective is selected.
_ADS_OBJECTIVE_KEYWORDS: Final[frozenset[str]] = frozenset(
    {"conversion", "traffic", "retargeting", "ads", "paid"}
)

#: Services added for hashtag / SEO research.
_HASHTAG_SERVICE: Final[str] = "bs_hashtag_research"

#: Services always safe to parallelise (chord header).
_ALWAYS_PARALLEL: Final[list[str]] = [
    "campaign_agent.analyze_brand",
    "campaign_agent.analyze_audience",
    "campaign_agent.suggest_influencers",
]

#: Estimated duration weights per service (seconds).
_DURATION_MAP: Final[dict[str, int]] = {
    "bs_ai_text": 8,
    "bs_ai_image": 15,
    "bs_ai_video": 25,
    "bs_scheduling": 3,
    "bs_influencer_match": 5,
    "bs_hashtag_research": 4,
    "bs_analytics": 2,
}


# ---------------------------------------------------------------------------
# ExecutionPlanner
# ---------------------------------------------------------------------------


class ExecutionPlanner:
    """Maps a CampaignIntent + BrandContext to an ExecutionPlan.

    The planner is stateless — it performs no I/O and can be instantiated
    without any dependencies.

    Usage::

        planner = ExecutionPlanner()
        plan = planner.plan(intent, context)
    """

    def plan(
        self,
        intent: CampaignIntent,
        context: BrandContext,
    ) -> ExecutionPlan:
        """Produce an ExecutionPlan for the given intent and brand context.

        Algorithm:
          1. Start with core services.
          2. Add video generation if the platform uses video.
          3. Add influencer matching if a budget is specified.
          4. Add ads targeting if the objective is conversion/traffic.
          5. Always add hashtag research.
          6. Estimate wall-clock duration from the service weight map.
          7. Return an ExecutionPlan.

        Args:
            intent:  Parsed CampaignIntent from the user prompt.
            context: BrandContext loaded from the database.

        Returns:
            ExecutionPlan with microservices, parallel_tasks, and
            estimated_duration_s.
        """
        services = list(_CORE_SERVICES)

        if intent.platform.lower() in _VIDEO_PLATFORMS:
            services.insert(
                services.index("bs_ai_image"),
                "bs_ai_video",
            )
            logger.debug(
                "[ExecutionPlanner] Added bs_ai_video for platform={}",
                intent.platform,
            )

        if intent.budget_influencer and float(intent.budget_influencer or 0) > 0:
            services.append(_INFLUENCER_SERVICE)
            logger.debug(
                "[ExecutionPlanner] Added influencer matching | budget={}",
                intent.budget_influencer,
            )

        objective_lower = (intent.objective or "").lower()
        if any(kw in objective_lower for kw in _ADS_OBJECTIVE_KEYWORDS):
            services.append("bs_ads_targeting")
            logger.debug(
                "[ExecutionPlanner] Added ads targeting | objective={}",
                intent.objective,
            )

        services.append(_HASHTAG_SERVICE)

        # Parallel tasks: always the three chord-header analysis tasks.
        parallel_tasks = list(_ALWAYS_PARALLEL)

        # If influencer service is included, it can also run in parallel.
        if _INFLUENCER_SERVICE in services:
            parallel_tasks.append(f"campaign_agent.{_INFLUENCER_SERVICE}")

        duration = _estimate_duration(services)

        logger.info(
            "[ExecutionPlanner] Plan built | platform={} services={} "
            "parallel={} est={}s | project={}",
            intent.platform,
            services,
            parallel_tasks,
            duration,
            context.project_id,
        )

        return ExecutionPlan(
            microservices=services,
            parallel_tasks=parallel_tasks,
            estimated_duration_s=duration,
        )


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def _estimate_duration(services: list[str]) -> int:
    """Sum the duration weights of all services, plus a fixed 5 s overhead.

    Args:
        services: List of microservice names in the plan.

    Returns:
        Estimated wall-clock duration in seconds.
    """
    total = sum(_DURATION_MAP.get(svc, 5) for svc in services)
    return total + 5  # +5 s orchestration overhead
