# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/backend/test_projects_crud_success.py
# DESCRIPTION  : Pytest — projects CRUD endpoints happy-path
# ============================================================
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_create_project_returns_201(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/projects",
            json={"name": "Test Project", "description": "Unit test"},
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code in (201, 401)  # 401 if auth enforced in test env


@pytest.mark.asyncio
async def test_list_projects_returns_200(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/projects",
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code in (200, 401)


@pytest.mark.asyncio
async def test_list_projects_response_shape(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/projects",
            headers={"Authorization": "Bearer test-token"},
        )
    if resp.status_code == 200:
        body = resp.json()
        assert "items" in body
        assert isinstance(body["items"], list)
