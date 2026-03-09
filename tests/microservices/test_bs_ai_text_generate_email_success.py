# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/microservices/test_bs_ai_text_generate_email_success.py
# DESCRIPTION  : Pytest — bs_ai_text generate_email_content happy-path
# ============================================================
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_generate_email_returns_subject_and_body():
    from microservices.bs_ai_text.service import generate_email_content

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        email_content = "Subject: Grow Your Business\n\nDear {{first_name}},\n\nDiscover BRANDSCALE."
        response = AsyncMock()
        response.choices = [AsyncMock(message=AsyncMock(content=email_content))]
        mock_client.return_value.chat.completions.create = AsyncMock(return_value=response)

        result = await generate_email_content(
            None,
            "00000000-0000-0000-0000-000000000001",
            language="fr",
            sector="saas",
            company="Acme",
        )

    assert isinstance(result, dict)
    assert isinstance(result["text"], str)
    assert len(result["text"]) > 10


@pytest.mark.asyncio
async def test_generate_email_falls_back_gracefully():
    from microservices.bs_ai_text.service import generate_email_content

    with patch("microservices.bs_ai_text.service.aioredis") as mock_redis, \
         patch("microservices.bs_ai_text.service.get_openai_client") as mock_client, \
         patch("microservices.bs_ai_text.service.get_local_client") as mock_local:

        redis_instance = AsyncMock()
        redis_instance.get = AsyncMock(return_value=None)
        redis_instance.setex = AsyncMock()
        redis_instance.aclose = AsyncMock()
        mock_redis.from_url.return_value = redis_instance

        mock_client.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("API unavailable")
        )
        mock_local.return_value.chat.completions.create = AsyncMock(
            side_effect=Exception("Local unavailable")
        )

        result = await generate_email_content(
            None,
            "00000000-0000-0000-0000-000000000002",
        )

    assert isinstance(result, dict)
    assert isinstance(result["text"], str)
    assert len(result["text"]) > 0
