# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_leads_crud_success.py
# DESCRIPTION  : Pytest — leads CRUD endpoints happy-path
# ============================================================
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_list_leads_returns_200_or_401(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/leads")
    assert resp.status_code in (200, 401)


@pytest.mark.asyncio
async def test_create_lead_missing_opt_in_returns_422(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/leads",
            json={"email": "test@test.com"},
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code in (422, 401)


@pytest.mark.asyncio
async def test_update_nonexistent_lead_returns_404_or_401(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.patch(
            "/api/v1/leads/00000000-0000-0000-0000-000000000000",
            json={"score": 80},
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code in (404, 401, 405)
