# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_text/service.py
# DESCRIPTION  : AI text generation service — posts, emails, ads, newsletters
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import redis.asyncio as aioredis
from loguru import logger
from sqlalchemy.dialects.postgresql import insert as pg_insert

from configs.ai_config import get_fallback_template, get_model_config, get_openai_client
from configs.settings import get_settings
from database.connection import db_session
from database.models_orm import Analytics

settings = get_settings()


# ---------------------------------------------------------------------------
# Redis cache helper
# ---------------------------------------------------------------------------
async def _get_redis() -> aioredis.Redis:  # type: ignore[type-arg]
    """Return an async Redis client."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _cache_key(prefix: str, **kwargs: Any) -> str:
    """Generate a deterministic cache key from prompt parameters."""
    payload = json.dumps(kwargs, sort_keys=True)
    digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"brandscale:ai_text:{prefix}:{digest}"


async def _get_cached(key: str) -> Optional[str]:
    """Retrieve a cached response or None."""
    try:
        client = await _get_redis()
        return await client.get(key)
    except Exception as exc:
        logger.warning("[bs_ai_text] Redis get failed | key={} error={}", key, str(exc))
        return None


async def _set_cached(key: str, value: str) -> None:
    """Store a response in Redis with TTL."""
    try:
        client = await _get_redis()
        await client.set(key, value, ex=settings.redis_cache_ttl)
    except Exception as exc:
        logger.warning("[bs_ai_text] Redis set failed | key={} error={}", key, str(exc))


async def _accumulate_ai_cost(campaign_id: uuid.UUID, cost_usd: float) -> None:
    """Upsert AI generation cost into today's Analytics row for the campaign."""
    if cost_usd <= 0:
        return
    today = datetime.now(timezone.utc).date()
    try:
        async with db_session() as session:
            stmt = (
                pg_insert(Analytics)
                .values(
                    id=uuid.uuid4(),
                    campaign_id=campaign_id,
                    date=today,
                    ai_cost_usd=cost_usd,
                )
                .on_conflict_do_update(
                    index_elements=["campaign_id", "date"],
                    set_={
                        "ai_cost_usd": Analytics.ai_cost_usd + cost_usd,
                        "updated_at": datetime.now(timezone.utc),
                    },
                )
            )
            await session.execute(stmt)
            await session.commit()
        logger.info(
            "[bs_ai_text] Cost persisted | campaign={} cost=${:.4f}", campaign_id, cost_usd
        )
    except Exception as exc:
        logger.error(
            "[bs_ai_text] Cost persist failed | campaign={} error={}", campaign_id, str(exc)
        )


# ---------------------------------------------------------------------------
# Core AI generation function
# ---------------------------------------------------------------------------
async def _generate_text(
    system_prompt: str,
    user_prompt: str,
    model_config_key: str,
    cache_key: str,
    campaign_id: Optional[uuid.UUID] = None,
) -> dict[str, Any]:
    """
    Call the OpenAI-compatible API to generate text.

    Checks Redis cache first. Falls back to template on API failure.

    Args:
        system_prompt:    System instruction for the AI.
        user_prompt:      User-facing prompt with context.
        model_config_key: Key into CONTENT_MODELS dict.
        cache_key:        Redis key for caching.

    Returns:
        Dict with text, tokens_used, cost_usd, from_fallback.
    """
    # 1. Check cache
    cached = await _get_cached(cache_key)
    if cached:
        logger.debug("[bs_ai_text] Cache hit | key={}", cache_key)
        return {
            "text": cached,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "from_fallback": False,
        }

    # 2. Call AI API
    config = get_model_config(model_config_key)
    client = get_openai_client()

    try:
        response = await client.chat.completions.create(
            model=config.name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            top_p=config.top_p,
        )

        text = response.choices[0].message.content or ""
        usage = response.usage
        tokens_used = usage.total_tokens if usage else 0
        cost_usd = (tokens_used / 1000) * 0.01  # approximate cost

        # Cache result
        await _set_cached(cache_key, text)

        logger.info(
            "[bs_ai_text] Generated | model={} tokens={} cost=${:.4f}",
            config.name, tokens_used, cost_usd,
        )
        if campaign_id is not None:
            await _accumulate_ai_cost(campaign_id, cost_usd)
        return {
            "text": text,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
            "from_fallback": False,
        }

    except Exception as exc:
        logger.error("[bs_ai_text] AI API error | error={}", str(exc))

        # 3. Fallback to local model if configured
        if settings.ai_fallback_to_local:
            try:
                from configs.ai_config import get_local_client

                local_client = get_local_client()
                response = await local_client.chat.completions.create(
                    model=settings.ollama_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=config.max_tokens,
                )
                text = response.choices[0].message.content or ""
                return {"text": text, "tokens_used": 0, "cost_usd": 0.0, "from_fallback": False}
            except Exception as local_exc:
                logger.error("[bs_ai_text] Local model also failed | error={}", str(local_exc))

        # 4. Template fallback
        fallback = get_fallback_template(model_config_key)
        return {"text": fallback, "tokens_used": 0, "cost_usd": 0.0, "from_fallback": True}


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------
async def generate_post(
    lead_id: Optional[uuid.UUID],
    tone: str = "professional",
    platform: str = "linkedin",
    language: str = "fr",
    campaign_id: Optional[uuid.UUID] = None,
) -> dict[str, Any]:
    """
    Generate a social media post for a lead.

    Args:
        lead_id:  Lead UUID (for personalisation context).
        tone:     Writing tone (professional/casual/inspirational).
        platform: Target platform (linkedin/twitter/instagram).
        language: Output language code.

    Returns:
        Dict with text, tokens_used, cost_usd, from_fallback.
    """
    system_prompt = (
        f"You are BRANDSCALE, a social media expert. "
        f"Write a {tone} post for {platform}. Language: {language}. "
        f"Max 280 characters for Twitter, 1300 for LinkedIn. Include relevant hashtags."
    )
    user_prompt = (
        f"Write a marketing post for platform={platform}, tone={tone}. "
        f"Lead context: id={lead_id}. Language: {language}."
    )
    key = _cache_key("post", lead_id=str(lead_id), tone=tone, platform=platform, lang=language)
    return await _generate_text(system_prompt, user_prompt, "post", key, campaign_id)


async def generate_email_content(
    lead_id: Optional[uuid.UUID],
    campaign_id: uuid.UUID,
    language: str = "fr",
) -> dict[str, Any]:
    """
    Generate personalised email body + subject for a lead.

    Args:
        lead_id:     Lead UUID for personalisation.
        campaign_id: Campaign UUID for context.
        language:    Output language code.

    Returns:
        Dict with text (formatted as SUBJECT\\n\\nBODY), tokens_used, cost_usd.
    """
    system_prompt = (
        "You are BRANDSCALE, an email marketing expert. "
        f"Write a personalised marketing email in {language}. "
        "Format: first line is the subject, then blank line, then email body. "
        "Always include [UNSUBSCRIBE_LINK] placeholder at the bottom (RGPD)."
    )
    user_prompt = (
        f"Write a personalised marketing email. "
        f"campaign_id={campaign_id} lead_id={lead_id} language={language}."
    )
    key = _cache_key("email", lead_id=str(lead_id), campaign_id=str(campaign_id), lang=language)
    return await _generate_text(system_prompt, user_prompt, "email", key, campaign_id)


async def generate_ad_copy(
    lead_id: Optional[uuid.UUID],
    tone: str = "persuasive",
    language: str = "fr",
    campaign_id: Optional[uuid.UUID] = None,
) -> dict[str, Any]:
    """
    Generate concise ad copy for a lead.

    Args:
        lead_id:  Lead UUID.
        tone:     Ad tone.
        language: Output language.

    Returns:
        Dict with generated ad copy text.
    """
    system_prompt = (
        f"You are BRANDSCALE, a digital ads copywriter. "
        f"Write {tone} ad copy in {language}. Max 150 characters. "
        "Strong CTA required."
    )
    user_prompt = f"Write ad copy for lead_id={lead_id}, tone={tone}, language={language}."
    key = _cache_key("ad", lead_id=str(lead_id), tone=tone, lang=language)
    return await _generate_text(system_prompt, user_prompt, "ad", key, campaign_id)


async def generate_newsletter(
    campaign_id: uuid.UUID,
    language: str = "fr",
) -> dict[str, Any]:
    """
    Generate a full newsletter for a campaign.

    Args:
        campaign_id: Campaign UUID.
        language:    Output language.

    Returns:
        Dict with newsletter body text.
    """
    system_prompt = (
        "You are BRANDSCALE, a newsletter editor. "
        f"Write a professional HTML-friendly newsletter in {language}. "
        "Include intro, main content sections, and CTA. "
        "Add [UNSUBSCRIBE_LINK] at the footer (RGPD)."
    )
    user_prompt = f"Write a newsletter for campaign_id={campaign_id}, language={language}."
    key = _cache_key("newsletter", campaign_id=str(campaign_id), lang=language)
    return await _generate_text(system_prompt, user_prompt, "newsletter", key, campaign_id)


async def generate_video_script(
    lead_id: Optional[uuid.UUID],
    campaign_id: uuid.UUID,
    language: str = "fr",
) -> dict[str, Any]:
    """
    Generate a video marketing script.

    Args:
        lead_id:     Lead UUID.
        campaign_id: Campaign UUID.
        language:    Script language.

    Returns:
        Dict with video script text.
    """
    system_prompt = (
        "You are BRANDSCALE, a video script writer. "
        f"Write a 60-second marketing video script in {language}. "
        "Include scene descriptions, narration, and timing cues."
    )
    user_prompt = (
        f"Write a video script for campaign_id={campaign_id}, "
        f"lead_id={lead_id}, language={language}."
    )
    key = _cache_key("video_script", lead_id=str(lead_id), campaign_id=str(campaign_id))
    return await _generate_text(system_prompt, user_prompt, "video_script", key, campaign_id)


if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await generate_post(lead_id=None, platform="linkedin", language="fr")
        print(f"[bs_ai_text] Smoke test result: {result['text'][:100]}...")

    asyncio.run(_smoke())
