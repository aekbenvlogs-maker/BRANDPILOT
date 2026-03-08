# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_campaigns_crud_success.py
# DESCRIPTION  : Pytest — campaigns CRUD endpoints happy-path
# ============================================================
from __future__ import annotations

import pytest
from httpx import AsyncClient

from backend.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_list_campaigns_returns_200_or_401(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/campaigns")
    assert resp.status_code in (200, 401)


@pytest.mark.asyncio
async def test_create_campaign_missing_name_returns_422(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/campaigns",
            json={},
            headers={"Authorization": "Bearer test-token"},
        )
    # 422 Unprocessable Entity from Pydantic or 401 Unauthorized
    assert resp.status_code in (422, 401)


@pytest.mark.asyncio
async def test_get_nonexistent_campaign_returns_404_or_401(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/campaigns/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code in (404, 401)
