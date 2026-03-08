# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_ai_text_generate_post_success.py
# DESCRIPTION  : Pytest — bs_ai_text generate_post happy-path
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_generate_post_returns_non_empty_string():
    from microservices.bs_ai_text.service import generate_post

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        response = AsyncMock()
        response.choices = [AsyncMock(message=AsyncMock(content="🚀 Scale your brand with AI!"))]
        mock_client.return_value.chat.completions.create = AsyncMock(return_value=response)

        result = await generate_post("SaaS", "professional")

    assert isinstance(result, str)
    assert "brand" in result.lower() or len(result) > 5


@pytest.mark.asyncio
async def test_generate_post_uses_cache_on_second_call():
    from microservices.bs_ai_text.service import generate_post

    cached_value = b"Cached marketing post"

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis:
        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=cached_value)
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        result = await generate_post("SaaS", "professional")

    assert result == "Cached marketing post"
