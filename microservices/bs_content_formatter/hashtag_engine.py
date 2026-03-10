# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/hashtag_engine.py
# DESCRIPTION  : AI-powered hashtag generation with category structure
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
import re

from loguru import logger

from configs.ai_config import get_openai_client, get_model_config

# ---------------------------------------------------------------------------
# Banned hashtag list (content policy + shadow-ban risk)
# ---------------------------------------------------------------------------
_BANNED_HASHTAGS = frozenset({
    "followforfollow", "f4f", "like4like", "l4l", "spam",
    "follow4follow", "likeforlike", "tagsforlikes", "gainpost",
    "instagramanet", "socialenvy", "pleasefollow", "direct",
    "bot", "nude", "naked", "xxx",
})


def _clean_tag(tag: str) -> str:
    """Normalise a hashtag: lowercase, strip leading #, remove spaces."""
    return re.sub(r"[^a-z0-9_]", "", tag.lower().replace(" ", ""))


async def generate_hashtags(
    brief: str,
    platform: str,
    niche: str,
    count: int = 30,
) -> list[str]:
    """
    Generate categorised hashtags for a piece of content.

    Categories:
    - broad (5 tags):       High-volume, generic.
    - niche (15 tags):      Medium-volume, topic-specific.
    - ultra_niche (10 tags): Low-volume, highly targeted.

    Args:
        brief:    Content description or excerpt.
        platform: Target social platform.
        niche:    Content niche (e.g. "beauty", "finance").
        count:    Total desired hashtag count (default 30).

    Returns:
        List of hashtag strings (without leading #).
    """
    broad_count = max(5, count // 6)
    niche_count = max(10, count // 2)
    ultra_count = count - broad_count - niche_count

    system_prompt = (
        "You are a social media hashtag specialist. "
        "Return a JSON object with three keys: 'broad', 'niche', 'ultra_niche'. "
        "Each key maps to an array of lowercase hashtags WITHOUT the # symbol. "
        "Never include banned or spammy tags."
    )
    user_prompt = (
        f"Platform: {platform}\n"
        f"Niche: {niche}\n"
        f"Content brief: {brief}\n\n"
        f"Generate:\n"
        f"- {broad_count} broad hashtags (high volume, generic)\n"
        f"- {niche_count} niche hashtags (topic-specific)\n"
        f"- {ultra_count} ultra-niche hashtags (very targeted, long-tail)\n\n"
        "Return ONLY valid JSON."
    )

    client = get_openai_client()
    model_cfg = get_model_config()
    try:
        response = await client.chat.completions.create(
            model=model_cfg.get("model", "gpt-4o"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=600,
        )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)
    except Exception as exc:
        logger.warning("hashtag_engine GPT call failed: {}", exc)
        return []

    all_tags: list[str] = []
    for category in ("broad", "niche", "ultra_niche"):
        tags = data.get(category, [])
        for tag in tags:
            cleaned = _clean_tag(str(tag))
            if cleaned and cleaned not in _BANNED_HASHTAGS and cleaned not in all_tags:
                all_tags.append(cleaned)

    return all_tags[:count]
