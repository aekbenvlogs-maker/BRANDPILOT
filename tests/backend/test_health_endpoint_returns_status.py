# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_health_endpoint_returns_status.py
# DESCRIPTION  : Pytest — health endpoint smoke test
# ============================================================
from __future__ import annotations

import pytest
from httpx import AsyncClient

from backend.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_endpoint_returns_json(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/health")
    assert "application/json" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_health_response_has_status_field(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/v1/health")
    if resp.status_code == 200:
        body = resp.json()
        assert "status" in body
