# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_content_generate_success.py
# DESCRIPTION  : Pytest — content generation service unit tests
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_generate_post_returns_string():
    from microservices.bs_ai_text.service import generate_post

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        mock_choice = AsyncMock()
        mock_choice.choices = [AsyncMock(message=AsyncMock(content="Generated post content"))]
        openai_instance = AsyncMock()
        openai_instance.chat.completions.create = AsyncMock(return_value=mock_choice)
        mock_client.return_value = openai_instance

        result = await generate_post(None, "professional", sector="SaaS")

    assert isinstance(result, dict)
    assert isinstance(result["text"], str)
    assert len(result["text"]) > 0


@pytest.mark.asyncio
async def test_generate_post_returns_fallback_on_api_error():
    from microservices.bs_ai_text.service import generate_post

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client, \
         patch("microservices.bs_ai_text.service.get_local_client") as mock_local:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        mock_client.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("API down")
        )
        mock_local.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("Local down too")
        )

        result = await generate_post(None, "professional", sector="SaaS")

    assert isinstance(result, dict)
    assert result["from_fallback"] is True
    assert len(result["text"]) > 0
