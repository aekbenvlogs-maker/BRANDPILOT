# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/competitor.py
# DESCRIPTION  : GPT-4 competitor discovery from scraped content
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
from dataclasses import dataclass

from loguru import logger

from configs.ai_config import get_openai_client
from microservices.bs_brand_analyzer.scraper import ScrapedContent
from microservices.bs_brand_analyzer.tone_analyzer import ToneAnalysis

_SYSTEM = (
    "You are a market intelligence analyst. "
    "Identify potential competitors for a brand based on its website content. "
    "Respond ONLY with valid JSON."
)


@dataclass
class Competitor:
    name: str
    url: str
    niche: str
    tone: str
    strengths: list[str]


async def find_competitors(
    scraped_content: ScrapedContent,
    tone_analysis: ToneAnalysis,
) -> list[Competitor]:
    """
    Identify 3 potential competitors using GPT-4.

    Args:
        scraped_content: Website data from scraper.
        tone_analysis:   Detected tone/keywords.

    Returns:
        List of up to 3 Competitor dataclass instances.
    """
    client = get_openai_client()

    user_msg = (
        f"Brand URL: {scraped_content.url}\n"
        f"Title: {scraped_content.title}\n"
        f"Description: {scraped_content.description}\n"
        f"Detected tone: {tone_analysis.tone}\n"
        f"Key keywords: {', '.join(tone_analysis.keywords)}\n"
        f"Target audience: {tone_analysis.target_audience}\n\n"
        "Identify exactly 3 real potential competitors.\n"
        "Respond with JSON array:\n"
        '[{"name":"...","url":"...","niche":"...","tone":"...","strengths":["...","..."]}]'
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": user_msg},
            ],
            max_tokens=600,
            temperature=0.3,
        )
        raw = response.choices[0].message.content or "[]"
        # Strip markdown code fences if present
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        items: list[dict[str, object]] = json.loads(raw)
    except Exception as exc:
        logger.warning("[competitor] GPT-4 call failed: {}", exc)
        return []

    results: list[Competitor] = []
    for item in items[:3]:
        results.append(
            Competitor(
                name=str(item.get("name", "")),
                url=str(item.get("url", "")),
                niche=str(item.get("niche", "")),
                tone=str(item.get("tone", "")),
                strengths=list(item.get("strengths", [])),  # type: ignore[arg-type]
            )
        )
    return results
