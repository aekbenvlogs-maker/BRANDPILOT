# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/campaign_agent/context_builder.py
# DESCRIPTION  : ContextBuilder — loads brand context and connected social
#                accounts from the database for the Campaign Agent pipeline.
# AUTHOR       : BRANDPILOT Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================
"""
ContextBuilder: Step 2 of the Campaign Agent pipeline.

Responsibilities:
  1. Load the Project record (brand name, description, archived guard).
  2. Detect brand tone from the project description via a lightweight
     keyword heuristic (extendable to an AI classifier in v2).
  3. Load connected social accounts (or return sensible defaults if none).
  4. Build and return a BrandContext dataclass ready for the agent.

Usage:
    builder = ContextBuilder(db)
    context = await builder.build(project_id="uuid-string")
"""

from __future__ import annotations

import re
import uuid
from typing import Final

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models_orm import Project
from microservices.campaign_agent.agent import BrandContext

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Keyword → tone mapping.  Order matters: first match wins.
_TONE_KEYWORDS: Final[list[tuple[str, str]]] = [
    (r"\b(luxury|premium|exclusive|prestige)\b", "luxury"),
    (r"\b(fun|playful|witty|humour|humor|quirky)\b", "playful"),
    (r"\b(energy|energetic|dynamic|bold|vibrant)\b", "energetic"),
    (r"\b(inspire|inspirational|motivat|uplift)\b", "inspirational"),
    (r"\b(trust|reliable|professional|expert|authorit)\b", "professional"),
    (r"\b(sustain|eco|green|planet|environment)\b", "sustainable"),
    (r"\b(innovat|tech|digital|cutting.edge|disrupt)\b", "innovative"),
]

_DEFAULT_TONE: Final[str] = "professional"
_DEFAULT_AUDIENCE: Final[str] = "general audience"


# ---------------------------------------------------------------------------
# ContextBuilder
# ---------------------------------------------------------------------------


class ContextBuilder:
    """Loads and assembles BrandContext from the BRANDPILOT database.

    This class implements the ``ContextBuilderProtocol`` interface defined in
    ``agent.py`` so it can be injected into ``CampaignAgent``.

    Args:
        db: Injected async SQLAlchemy session.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def build(self, project_id: str) -> BrandContext:
        """Load and return the BrandContext for a given project.

        Steps:
          1. Fetch Project ORM row.
          2. Guard: archived projects cannot generate campaigns.
          3. Detect brand tone from project description.
          4. Resolve connected social accounts (future: SocialAccount table).
          5. Return populated BrandContext.

        Args:
            project_id: String UUID of the project.

        Returns:
            BrandContext with brand_name, brand_tone, social_accounts,
            target_audience populated.

        Raises:
            ValueError: project_id does not exist or project is archived.
        """
        project = await self._fetch_project(project_id)
        self._guard_not_archived(project)

        brand_name = project.name
        description = project.description or ""
        brand_tone = _detect_tone(description)
        social_accounts = await self._load_social_accounts(project_id)
        target_audience = _extract_audience_hint(description)

        logger.debug(
            "[ContextBuilder] Built context | project={} brand={!r} tone={} "
            "accounts={} audience={!r}",
            project_id,
            brand_name,
            brand_tone,
            social_accounts,
            target_audience[:60] if target_audience else "",
        )

        return BrandContext(
            project_id=project_id,
            brand_name=brand_name,
            brand_tone=brand_tone,
            social_accounts=social_accounts,
            target_audience=target_audience,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _fetch_project(self, project_id: str) -> Project:
        """Fetch the Project ORM row or raise ValueError.

        Args:
            project_id: String UUID of the project.

        Returns:
            Project ORM instance.

        Raises:
            ValueError: No project found with the given ID.
        """
        result = await self._db.execute(
            select(Project).where(Project.id == uuid.UUID(project_id))
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError(
                f"Project '{project_id}' not found. "
                "Cannot build brand context for a non-existent project."
            )
        return project

    @staticmethod
    def _guard_not_archived(project: Project) -> None:
        """Block campaign generation for archived projects.

        Args:
            project: Loaded Project ORM instance.

        Raises:
            ValueError: Project is archived.
        """
        if project.archived:
            raise ValueError(
                f"Project '{project.id}' is archived. "
                "Reactivate the project before generating campaigns."
            )

    async def _load_social_accounts(self, project_id: str) -> list[str]:
        """Return list of connected social account identifiers.

        Currently returns a placeholder list because the SocialAccount table
        has not yet been migrated.  Replace this method body once the table
        exists.

        Args:
            project_id: String UUID of the project.

        Returns:
            List of platform identifiers, e.g. ``["instagram", "tiktok"]``.
        """
        # TODO: replace with real DB query once SocialAccount ORM is migrated.
        # Example future query:
        #   result = await self._db.execute(
        #       select(SocialAccount.platform)
        #       .where(SocialAccount.project_id == uuid.UUID(project_id))
        #       .where(SocialAccount.connected == True)
        #   )
        #   return [row[0] for row in result.all()]
        logger.debug(
            "[ContextBuilder] No SocialAccount table yet — returning default "
            "platforms | project={}",
            project_id,
        )
        return ["instagram", "tiktok"]


# ---------------------------------------------------------------------------
# Pure-function helpers
# ---------------------------------------------------------------------------


def _detect_tone(description: str) -> str:
    """Detect brand tone from a project description using keyword heuristics.

    Matches against a priority-ordered list of regex patterns.  If no
    pattern matches, falls back to ``'professional'``.

    Args:
        description: Free-form project description text.

    Returns:
        Brand tone string, e.g. ``'energetic'``, ``'luxury'``.

    Example:
        >>> _detect_tone("We create premium eco-friendly products")
        'luxury'
    """
    lowered = description.lower()
    for pattern, tone in _TONE_KEYWORDS:
        if re.search(pattern, lowered):
            return tone
    return _DEFAULT_TONE


def _extract_audience_hint(description: str) -> str:
    """Extract a target audience hint from the project description.

    Looks for common audience-signal phrases and returns the surrounding
    sentence fragment.  Falls back to a generic default.

    Args:
        description: Free-form project description text.

    Returns:
        Short audience description string.

    Example:
        >>> _extract_audience_hint("Targeting millennials aged 25-35 in urban areas")
        'millennials aged 25-35 in urban areas'
    """
    patterns = [
        r"target(?:ing|ed)?\s+(.{5,80}?)(?:\.|,|$)",
        r"audience(?:\s+of)?\s+(.{5,80}?)(?:\.|,|$)",
        r"(?:for|reach(?:ing)?)\s+(.{5,60}?\s+(?:user|customer|consumer|buyer|fan|follower)s?)(?:\.|,|$)",
    ]
    lowered = description.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered)
        if match:
            return match.group(1).strip()
    return _DEFAULT_AUDIENCE
