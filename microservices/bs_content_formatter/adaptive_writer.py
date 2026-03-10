# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/adaptive_writer.py
# DESCRIPTION  : AI-powered content rewriter adapted per platform
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from configs.ai_config import get_openai_client, get_model_config

_PLATFORM_CONSTRAINTS = {
    "instagram": {
        "tone": "casual and visual, use emojis sparingly, line breaks every 1-2 sentences",
        "max_chars": 2200,
        "cta": "add a CTA like 'link in bio' or question to boost comments",
    },
    "tiktok": {
        "tone": "energetic, hook in first line, very short paragraphs",
        "max_chars": 2200,
        "cta": "end with a challenge or question to boost stitches/duets",
    },
    "youtube": {
        "tone": "informative and engaging, SEO-friendly title and description",
        "max_chars": 5000,
        "cta": "subscribe + like CTA in first 2 lines",
    },
    "x": {
        "tone": "punchy, opinionated, concise",
        "max_chars": 280,
        "cta": "end with a question or provocation",
    },
    "linkedin": {
        "tone": "professional but personable, share a lesson or insight",
        "max_chars": 3000,
        "cta": "end with an open question to spark conversation",
    },
}


async def rewrite_for_platform(
    content: str,
    source_platform: str,
    target_platform: str,
    brand_data: dict | None = None,
) -> str:
    """
    Rewrite content from one platform format to another using GPT-4o.

    Args:
        content:         Original content text.
        source_platform: Platform the content was written for.
        target_platform: Platform to adapt the content to.
        brand_data:      Optional brand tone/style context.

    Returns:
        Adapted content string.
    """
    if source_platform == target_platform:
        return content

    constraints = _PLATFORM_CONSTRAINTS.get(target_platform, {})
    brand_context = ""
    if brand_data:
        tone = brand_data.get("tone", "")
        style = brand_data.get("style_notes", "")
        brand_context = f"\nBrand tone: {tone}. Style notes: {style}."

    system_prompt = (
        "You are an expert social media content strategist. "
        "Adapt the given content for the target platform respecting its constraints."
    )
    user_prompt = (
        f"Original content (written for {source_platform}):\n\n{content}\n\n"
        f"Rewrite it for {target_platform.upper()}.\n"
        f"- Tone: {constraints.get('tone', 'professional')}\n"
        f"- Max characters: {constraints.get('max_chars', 2000)}\n"
        f"- CTA guidance: {constraints.get('cta', '')}\n"
        f"{brand_context}\n\n"
        "Return ONLY the rewritten content, no explanation."
    )

    client = get_openai_client()
    model_cfg = get_model_config()
    response = await client.chat.completions.create(
        model=model_cfg.get("model", "gpt-4o"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=1500,
    )
    return response.choices[0].message.content.strip()
