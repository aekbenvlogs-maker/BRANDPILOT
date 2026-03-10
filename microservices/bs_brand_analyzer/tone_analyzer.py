# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/tone_analyzer.py
# DESCRIPTION  : GPT-4 tone analysis from scraped website content
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
from dataclasses import dataclass

from loguru import logger

from configs.ai_config import get_model_config, get_openai_client
from microservices.bs_brand_analyzer.scraper import ScrapedContent

_VALID_TONES = frozenset(
    {"formal", "creative", "inspirational", "energetic", "professional", "humorous"}
)


@dataclass
class ToneAnalysis:
    tone: str
    confidence: float          # 0.0–1.0
    keywords: list[str]
    target_audience: str
    style_notes: str


_SYSTEM = (
    "You are an expert brand strategist. "
    "Analyse the editorial tone of a website from its scraped text. "
    "Respond ONLY with valid JSON matching the schema provided."
)

_SCHEMA = """
{
  "tone": "<one of: formal|creative|inspirational|energetic|professional|humorous>",
  "confidence": <float 0.0-1.0>,
  "keywords": ["<keyword>", ...],          // 5 most representative keywords
  "target_audience": "<description>",
  "style_notes": "<brief observation>"
}
"""


async def analyze_tone(scraped_content: ScrapedContent) -> ToneAnalysis:
    """
    Analyse the editorial tone from scraped website content using GPT-4.

    Args:
        scraped_content: Structured content from scraper.scrape_website().

    Returns:
        ToneAnalysis dataclass.
    """
    config = get_model_config()
    client = get_openai_client()

    excerpt = (scraped_content.main_text or "")[:3000]
    user_msg = (
        f"Website URL: {scraped_content.url}\n"
        f"Title: {scraped_content.title}\n"
        f"Meta description: {scraped_content.description}\n\n"
        f"Main text (first 3000 chars):\n{excerpt}\n\n"
        f"Respond with JSON matching this schema:\n{_SCHEMA}"
    )

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        max_tokens=400,
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data: dict[str, object] = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("[tone_analyzer] JSON parse failed; falling back to defaults")
        data = {}

    tone = str(data.get("tone", "professional")).lower()
    if tone not in _VALID_TONES:
        tone = "professional"

    return ToneAnalysis(
        tone=tone,
        confidence=float(data.get("confidence", 0.5)),  # type: ignore[arg-type]
        keywords=list(data.get("keywords", [])),  # type: ignore[arg-type]
        target_audience=str(data.get("target_audience", "")),
        style_notes=str(data.get("style_notes", "")),
    )
