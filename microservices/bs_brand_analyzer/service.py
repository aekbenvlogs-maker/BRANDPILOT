# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/service.py
# DESCRIPTION  : BrandAnalyzerService — full pipeline: scrape → tone → visual
#                → competitors → score → persist
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import db_session
from database.models_orm import Project
from microservices.bs_brand_analyzer.competitor import Competitor, find_competitors
from microservices.bs_brand_analyzer.scraper import ScrapedContent, scrape_website
from microservices.bs_brand_analyzer.tone_analyzer import ToneAnalysis, analyze_tone
from microservices.bs_brand_analyzer.visual_analyzer import VisualAnalysis, analyze_brand_visuals


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class BrandAnalysis:
    id: str
    project_id: str
    source_url: str
    detected_tone: str
    detected_niche: str
    primary_colors: list[str]
    keywords: list[str]
    target_audience: str
    consistency_score: int
    competitors: list[dict[str, object]]
    raw_report: str
    created_at: str


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _compute_consistency_score(
    tone: ToneAnalysis,
    visual: VisualAnalysis,
    scraped: ScrapedContent,
) -> int:
    """
    Heuristic brand consistency score 0–100.

    Factors:
    - Tone confidence (0–40 pts)
    - Has primary colors (0–20 pts)
    - Has OG meta tags (0–20 pts)
    - Has target audience (0–20 pts)
    """
    score = 0
    score += int(tone.confidence * 40)
    score += 20 if visual.primary_colors else 0
    score += 20 if scraped.og_data else 0
    score += 20 if tone.target_audience else 0
    return min(score, 100)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _persist_analysis(
    session: AsyncSession,
    project_id: uuid.UUID,
    source_url: str,
    tone: ToneAnalysis,
    visual: VisualAnalysis,
    competitors: list[Competitor],
    consistency_score: int,
    niche: str,
) -> str:
    from sqlalchemy import text as sa_text

    analysis_id = str(uuid.uuid4())
    now = datetime.now(UTC)

    await session.execute(
        sa_text(
            "INSERT INTO brand_analyses "
            "(id, project_id, source_url, detected_tone, detected_niche, "
            " primary_colors, keywords, target_audience, consistency_score, "
            " competitors, raw_report, created_at) "
            "VALUES (:id, :project_id, :source_url, :tone, :niche, "
            " CAST(:colors AS JSONB), CAST(:keywords AS JSONB), "
            " :audience, :score, CAST(:competitors AS JSONB), :report, :now)"
        ),
        {
            "id": analysis_id,
            "project_id": str(project_id),
            "source_url": source_url,
            "tone": tone.tone,
            "niche": niche,
            "colors": json.dumps(visual.primary_colors),
            "keywords": json.dumps(tone.keywords),
            "audience": tone.target_audience,
            "score": consistency_score,
            "competitors": json.dumps([
                {
                    "name": c.name,
                    "url": c.url,
                    "niche": c.niche,
                    "tone": c.tone,
                    "strengths": c.strengths,
                }
                for c in competitors
            ]),
            "report": tone.style_notes,
            "now": now,
        },
    )
    return analysis_id


async def _update_project(
    session: AsyncSession,
    project_id: uuid.UUID,
    tone: str,
    brand_url: str,
) -> None:
    await session.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(tone=tone, brand_url=brand_url)
    )


# ---------------------------------------------------------------------------
# Public service function
# ---------------------------------------------------------------------------

async def analyze_brand(
    project_id: str,
    source_url: str,
) -> BrandAnalysis:
    """
    Full brand analysis pipeline.

    1. Scrape the website.
    2. Analyse editorial tone (GPT-4).
    3. Analyse brand visuals (Pillow + GPT-4 Vision).
    4. Find competitors (GPT-4).
    5. Compute consistency score.
    6. Persist to brand_analyses + update project.

    Args:
        project_id: UUID string of the project.
        source_url: URL of the brand website to analyse.

    Returns:
        BrandAnalysis dataclass.
    """
    pid = uuid.UUID(project_id)
    logger.info("[brand_analyzer] Starting analysis project_id={} url={}", project_id, source_url)

    scraped: ScrapedContent = await scrape_website(source_url)
    tone: ToneAnalysis = await analyze_tone(scraped)
    visual: VisualAnalysis = await analyze_brand_visuals(scraped.image_urls)
    competitors: list[Competitor] = await find_competitors(scraped, tone)
    score = _compute_consistency_score(tone, visual, scraped)

    # Derive niche from keywords (first keyword as proxy)
    niche = tone.keywords[0] if tone.keywords else "general"

    async with db_session() as session:
        analysis_id = await _persist_analysis(
            session, pid, source_url, tone, visual, competitors, score, niche
        )
        await _update_project(session, pid, tone.tone, source_url)
        await session.commit()

    logger.info("[brand_analyzer] Analysis complete id={} score={}", analysis_id, score)

    return BrandAnalysis(
        id=analysis_id,
        project_id=project_id,
        source_url=source_url,
        detected_tone=tone.tone,
        detected_niche=niche,
        primary_colors=visual.primary_colors,
        keywords=tone.keywords,
        target_audience=tone.target_audience,
        consistency_score=score,
        competitors=[
            {"name": c.name, "url": c.url, "niche": c.niche, "tone": c.tone, "strengths": c.strengths}
            for c in competitors
        ],
        raw_report=tone.style_notes,
        created_at=datetime.now(UTC).isoformat(),
    )
