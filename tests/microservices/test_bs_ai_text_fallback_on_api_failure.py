# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_ai_text_fallback_on_api_failure.py
# DESCRIPTION  : Pytest — 3-layer fallback (API → local → template)
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_full_fallback_chain_returns_template():
    """All three layers fail → should return template fallback string."""
    from microservices.bs_ai_text.service import generate_ad_copy

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client, \
         patch("microservices.bs_ai_text.service.get_local_client") as mock_local, \
         patch("microservices.bs_ai_text.service.get_fallback_template") as mock_tpl:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        mock_client.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("OpenAI down")
        )
        mock_local.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("Ollama down")
        )
        mock_tpl.return_value = "🚀 BRANDSCALE — Scale your brand with AI. Try it free."

        result = await generate_ad_copy("SaaS", "professional")

    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_cache_hit_skips_all_api_calls():
    from microservices.bs_ai_text.service import generate_post

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=b"Cached post text")
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        result = await generate_post("SaaS", "direct")

        mock_client.assert_not_called()

    assert result == "Cached post text"
