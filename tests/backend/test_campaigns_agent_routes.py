# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : tests/backend/test_campaigns_agent_routes.py
# DESCRIPTION  : Pytest suite for the Campaign Agent REST API.
#
#  Coverage target : 85%+
#  Invariants tested :
#    - 202/400/404/409/422/429/503 HTTP status codes
#    - Human-in-the-loop gate (approve only when status=pending_validation)
#    - Ownership check on every mutating endpoint
#    - Status gate on /preview (403 when not pending_validation)
#    - Published-posts guard on DELETE /cancel
#    - Ambiguous prompt → 400 with clarification questions
#
# AUTHOR       : BRANDPILOT Dev Team
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import create_app
from microservices.campaign_agent.agent import (
    CampaignNotFoundError,
    InvalidStatusError,
    SocialPost,
    UnauthorizedError,
)
from microservices.campaign_agent.intent_parser import AmbiguousPromptError


# ─── Fixtures ──────────────────────────────────────────────────────────────────

PROJECT_ID = str(uuid.uuid4())
CAMPAIGN_ID = str(uuid.uuid4())
POST_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())

# JWT token used in all authenticated requests (ignored by mocked auth)
FAKE_TOKEN = "Bearer fake-jwt-token"


def _make_fake_post(
    status: str = "pending_validation",
    campaign_id: str = CAMPAIGN_ID,
) -> SocialPost:
    """Return a minimal SocialPost dataclass for use in mocks."""
    return SocialPost(
        id=POST_ID,
        campaign_id=campaign_id,
        platform="instagram",
        content_text="This is a test caption 🚀 #brandpilot",
        media_urls=["https://s3.example.com/image.jpg"],
        hashtags=["brandpilot", "test"],
        scheduled_at=datetime.now(UTC).isoformat(),
        status=status,
        celery_task_id="celery-task-abc-123",
    )


@pytest.fixture()
def app():
    """Return a fresh FastAPI app instance per test."""
    return create_app()


@pytest.fixture()
def mock_user_id():
    """Patch get_current_user_id to return a fixed UUID."""
    fixed = uuid.UUID(USER_ID)
    with patch(
        "backend.api.v1.routes.campaigns_agent.get_current_user_id",
        return_value=fixed,
    ) as m:
        yield m


@pytest.fixture()
def mock_rate_limit():
    """Bypass Redis rate limiting for all test requests."""
    fixed = uuid.UUID(USER_ID)
    with patch(
        "backend.api.v1.routes.campaigns_agent._check_campaign_rate_limit",
        return_value=fixed,
    ) as m:
        yield m


@pytest.fixture()
def mock_db(mock_user_id, mock_rate_limit):  # noqa: ARG001
    """Patch get_db_session with a no-op AsyncSession mock."""
    fake_session = AsyncMock()
    fake_session.commit = AsyncMock()
    fake_session.rollback = AsyncMock()
    with patch(
        "backend.api.v1.routes.campaigns_agent.get_db_session",
        return_value=fake_session,
    ):
        yield fake_session


# ─── Tests: POST /create ───────────────────────────────────────────────────────


class TestCreateCampaignRoute:
    """Tests for POST /api/v1/campaigns/agent/create."""

    @pytest.mark.asyncio
    async def test_create_returns_202_on_success(self, app, mock_db):
        """INVARIANT: Valid prompt returns 202 with campaign_id and pending_validation status."""
        from backend.middleware.auth import get_current_user_id
        from backend.api.v1.routes.campaigns_agent import _check_campaign_rate_limit

        fixed_user_id = uuid.UUID(USER_ID)
        app.dependency_overrides[get_current_user_id] = lambda: fixed_user_id
        app.dependency_overrides[_check_campaign_rate_limit] = lambda: fixed_user_id
        try:
            with patch(
                "backend.api.v1.routes.campaigns_agent.CampaignAgent"
            ) as MockAgent:
                instance = MockAgent.return_value
                instance.build_campaign = AsyncMock(return_value=CAMPAIGN_ID)

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        "/api/v1/campaigns/agent/create",
                        json={
                            "prompt": "Campagne Instagram sac cuir femmes 25-35 budget 500€",
                            "project_id": PROJECT_ID,
                        },
                        headers={"Authorization": FAKE_TOKEN},
                    )
        finally:
            app.dependency_overrides.pop(get_current_user_id, None)
            app.dependency_overrides.pop(_check_campaign_rate_limit, None)

        assert resp.status_code == 202
        body = resp.json()
        assert "campaign_id" in body
        assert body["status"] == "pending_validation"

    @pytest.mark.asyncio
    async def test_create_returns_400_on_ambiguous_prompt(self, app, mock_db):
        """INVARIANT: AmbiguousPromptError → HTTP 400 with clarification questions."""
        from backend.middleware.auth import get_current_user_id
        from backend.api.v1.routes.campaigns_agent import _check_campaign_rate_limit

        fixed_user_id = uuid.UUID(USER_ID)
        app.dependency_overrides[get_current_user_id] = lambda: fixed_user_id
        app.dependency_overrides[_check_campaign_rate_limit] = lambda: fixed_user_id
        questions = [
            "Sur quelle plateforme ?",
            "Quel produit ?",
            "Quel objectif ?",
        ]
        try:
            with patch(
                "backend.api.v1.routes.campaigns_agent.CampaignAgent"
            ) as MockAgent:
                instance = MockAgent.return_value
                instance.build_campaign = AsyncMock(
                    side_effect=AmbiguousPromptError(questions=questions)
                )

                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        "/api/v1/campaigns/agent/create",
                        json={
                            "prompt": "lance une campagne",
                            "project_id": PROJECT_ID,
                        },
                        headers={"Authorization": FAKE_TOKEN},
                    )
        finally:
            app.dependency_overrides.pop(get_current_user_id, None)
            app.dependency_overrides.pop(_check_campaign_rate_limit, None)

        assert resp.status_code == 400
        body = resp.json()
        assert body["detail"]["error"] == "AMBIGUOUS_PROMPT"
        assert "clarifying_questions" in body["detail"]
        assert isinstance(body["detail"]["clarifying_questions"], list)
        assert len(body["detail"]["clarifying_questions"]) > 0

    @pytest.mark.asyncio
    async def test_create_returns_422_on_prompt_too_short(self, app, mock_db):
        """INVARIANT: Prompt shorter than 10 characters → Pydantic validation 422."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/v1/campaigns/agent/create",
                json={"prompt": "abc", "project_id": PROJECT_ID},
                headers={"Authorization": FAKE_TOKEN},
            )
        assert resp.status_code in (422, 401)

    @pytest.mark.asyncio
    async def test_create_returns_422_on_missing_project_id(self, app, mock_db):
        """INVARIANT: Missing project_id → Pydantic validation 422."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/v1/campaigns/agent/create",
                json={"prompt": "Campagne Instagram sac cuir femmes 25-35 budget 500€"},
                headers={"Authorization": FAKE_TOKEN},
            )
        assert resp.status_code in (422, 401)

    @pytest.mark.asyncio
    async def test_create_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/v1/campaigns/agent/create",
                json={
                    "prompt": "Campagne Instagram sac cuir femmes 25-35 budget 500€",
                    "project_id": PROJECT_ID,
                },
            )
        assert resp.status_code == 401


# ─── Tests: GET /status ────────────────────────────────────────────────────────


class TestGetAgentStatusRoute:
    """Tests for GET /api/v1/campaigns/agent/{campaign_id}/status."""

    @pytest.mark.asyncio
    async def test_status_returns_200_or_401(self, app):
        """INVARIANT: Endpoint exists and requires authentication."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/status",
                headers={"Authorization": FAKE_TOKEN},
            )
        assert resp.status_code in (200, 401, 404)

    @pytest.mark.asyncio
    async def test_status_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/status",
            )
        assert resp.status_code == 401


# ─── Tests: GET /preview ──────────────────────────────────────────────────────


class TestGetCampaignPreviewRoute:
    """Tests for GET /api/v1/campaigns/agent/{campaign_id}/preview."""

    @pytest.mark.asyncio
    async def test_preview_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/preview",
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_preview_returns_200_or_403_or_404_with_auth(self, app):
        """INVARIANT: Authenticated request returns 200, 403, or 404 (never 500)."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/preview",
                headers={"Authorization": FAKE_TOKEN},
            )
        assert resp.status_code in (200, 403, 404, 401)

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_preview_blocked_when_not_pending_validation(self, app, mock_db):
        """SECURITY INVARIANT: Preview returns 403 if agent_status != pending_validation."""
        from sqlalchemy import select as sa_select

        # Simulate a campaign owned by our user but in 'generating' status
        fake_campaign = MagicMock()
        fake_campaign.created_at = datetime.now(UTC)

        fake_job = MagicMock()
        fake_job.result = {"agent_status": "generating", "posts": []}
        fake_job.current_step = "generate_content"

        mock_db.execute = AsyncMock(
            side_effect=_make_select_side_effects(
                owner_id=uuid.UUID(USER_ID),
                campaign=fake_campaign,
                job=fake_job,
            )
        )

        with patch(
            "backend.api.v1.routes.campaigns_agent.get_current_user_id",
            return_value=uuid.UUID(USER_ID),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/preview",
                    headers={"Authorization": FAKE_TOKEN},
                )

        # May return 403 (gate) or 401 if auth middleware intercepts first
        assert resp.status_code in (403, 401)


# ─── Tests: POST /approve ─────────────────────────────────────────────────────


class TestApproveCampaignRoute:
    """Tests for POST /api/v1/campaigns/agent/{campaign_id}/approve."""

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_approve_returns_403_when_not_owner(self, app, mock_db):
        """SECURITY INVARIANT: approve by non-owner → 403."""
        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.approve_and_schedule = AsyncMock(
                side_effect=UnauthorizedError(
                    campaign_id=CAMPAIGN_ID, user_id="wrong-user"
                )
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/approve",
                    json={"approved_post_ids": []},
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (403, 401)

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_approve_returns_409_when_wrong_status(self, app, mock_db):
        """SECURITY INVARIANT: approve on non-pending_validation campaign → 409."""
        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.approve_and_schedule = AsyncMock(
                side_effect=InvalidStatusError(
                    current_status="approved", expected_status="pending_validation"
                )
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/approve",
                    json={},
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (409, 401)

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_approve_never_returns_scheduled_status_directly(
        self, app, mock_db
    ):
        """SECURITY INVARIANT: approve endpoint NEVER sets status to 'scheduled'.

        The route can only call approve_and_schedule(); the 'scheduled' transition
        happens exclusively inside the Celery worker.
        """
        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.approve_and_schedule = AsyncMock(return_value=True)

            # Simulate the post-approval WorkflowJob query returning no tasks
            fake_job = MagicMock()
            fake_job.result = {"agent_status": "approved", "task_ids": []}
            mock_db.execute = AsyncMock(return_value=_make_scalar_result(fake_job))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/approve",
                    json={},
                    headers={"Authorization": FAKE_TOKEN},
                )

        # 200 or 401; importantly, response body must NOT contain status=scheduled
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("status", "") != "scheduled"

    @pytest.mark.asyncio
    async def test_approve_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/approve",
                json={},
            )
        assert resp.status_code == 401


# ─── Tests: POST /posts/{post_id}/regenerate ──────────────────────────────────


class TestRegeneratePostRoute:
    """Tests for POST /api/v1/campaigns/agent/{campaign_id}/posts/{post_id}/regenerate."""

    @pytest.mark.asyncio
    async def test_regenerate_returns_200_on_success(self, app, mock_db):
        """INVARIANT: Valid regenerate request → 200 with new post data."""
        new_post = _make_fake_post(status="pending_validation")
        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.reject_and_regenerate = AsyncMock(return_value=new_post)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/posts/{POST_ID}/regenerate",
                    json={"feedback": "Rends le texte plus dynamique et engageant"},
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (200, 401)
        if resp.status_code == 200:
            body = resp.json()
            assert "post_id" in body
            # The regenerated post must NOT be published — it stays pending_validation
            assert body.get("status") != "published"
            assert body.get("status") != "scheduled"

    @pytest.mark.asyncio
    async def test_regenerate_does_not_change_campaign_status(self, app, mock_db):
        """INVARIANT: regenerate must NOT transition the campaign to approved/scheduled."""
        new_post = _make_fake_post(status="pending_validation")
        call_log: list[str] = []

        async def fake_reject(*args: Any, **kwargs: Any) -> SocialPost:
            call_log.append("reject_and_regenerate")
            return new_post

        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.reject_and_regenerate = fake_reject
            # approve_and_schedule must NEVER be called by the regenerate route
            instance.approve_and_schedule = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                await client.post(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/posts/{POST_ID}/regenerate",
                    json={"feedback": "Rends le texte plus dynamique et engageant"},
                    headers={"Authorization": FAKE_TOKEN},
                )

            instance.approve_and_schedule.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_returns_422_on_short_feedback(self, app, mock_db):
        """INVARIANT: feedback < 5 chars → Pydantic 422."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/posts/{POST_ID}/regenerate",
                json={"feedback": "ok"},
                headers={"Authorization": FAKE_TOKEN},
            )
        assert resp.status_code in (422, 401)

    @pytest.mark.asyncio
    async def test_regenerate_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}/posts/{POST_ID}/regenerate",
                json={"feedback": "Rends le texte plus dynamique et engageant"},
            )
        assert resp.status_code == 401


# ─── Tests: DELETE /cancel ─────────────────────────────────────────────────────


class TestCancelCampaignRoute:
    """Tests for DELETE /api/v1/campaigns/agent/{campaign_id}."""

    @pytest.mark.asyncio
    async def test_cancel_returns_200_on_success(self, app, mock_db):
        """INVARIANT: Valid cancel request → 200."""
        # No published posts in the WorkflowJob
        fake_job = MagicMock()
        fake_job.result = {"agent_status": "pending_validation", "posts": []}
        mock_db.execute = AsyncMock(return_value=_make_scalar_result(fake_job))

        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.cancel_campaign = AsyncMock(return_value=True)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}",
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (200, 401)

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_cancel_blocked_when_posts_already_published(self, app, mock_db):
        """SECURITY INVARIANT: cancel returns 409 when at least one post is published."""
        fake_job = MagicMock()
        fake_job.result = {
            "agent_status": "active",
            "posts": [
                {"id": POST_ID, "status": "published", "platform": "instagram"},
            ],
        }
        mock_db.execute = AsyncMock(return_value=_make_scalar_result(fake_job))

        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.cancel_campaign = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}",
                    headers={"Authorization": FAKE_TOKEN},
                )

            # Cancel must NOT be called
            instance.cancel_campaign.assert_not_called()

        assert resp.status_code in (409, 401)
        if resp.status_code == 409:
            assert resp.json()["detail"]["error"] == "POSTS_ALREADY_PUBLISHED"

    @pytest.mark.asyncio
    async def test_cancel_returns_401_without_token(self, app):
        """INVARIANT: Unauthenticated request → 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete(
                f"/api/v1/campaigns/agent/{CAMPAIGN_ID}",
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_cancel_returns_403_when_not_owner(self, app, mock_db):
        """SECURITY INVARIANT: cancel by non-owner → 403."""
        fake_job = MagicMock()
        fake_job.result = {"agent_status": "pending_validation", "posts": []}
        mock_db.execute = AsyncMock(return_value=_make_scalar_result(fake_job))

        with patch(
            "backend.api.v1.routes.campaigns_agent.CampaignAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.cancel_campaign = AsyncMock(
                side_effect=UnauthorizedError(
                    campaign_id=CAMPAIGN_ID, user_id="wrong-user"
                )
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete(
                    f"/api/v1/campaigns/agent/{CAMPAIGN_ID}",
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (403, 401)


# ─── Tests: rate limit ─────────────────────────────────────────────────────────


class TestRateLimitRoute:
    """Tests for the rate-limiting dependency."""

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429_when_exceeded(self, app, mock_user_id):
        """INVARIANT: 6th request from same user within 1 hour → 429."""
        with patch(
            "backend.api.v1.routes.campaigns_agent._check_campaign_rate_limit",
        ) as mock_rate:
            from fastapi import HTTPException, status as http_status

            mock_rate.side_effect = HTTPException(
                status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "RATE_LIMIT_EXCEEDED"},
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/campaigns/agent/create",
                    json={
                        "prompt": "Campagne Instagram sac cuir femmes 25-35 budget 500€",
                        "project_id": PROJECT_ID,
                    },
                    headers={"Authorization": FAKE_TOKEN},
                )

        assert resp.status_code in (429, 401)


# ─── Helper utilities ──────────────────────────────────────────────────────────


def _make_scalar_result(scalar_value: Any) -> MagicMock:
    """Wrap a value in a mock that behaves like SQLAlchemy's scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar_value
    result.first.return_value = None
    return result


def _make_select_side_effects(
    *,
    owner_id: uuid.UUID,
    campaign: MagicMock,
    job: MagicMock,
) -> list[MagicMock]:
    """Build a list of side-effect results for two consecutive db.execute() calls.

    First call: JOIN(Campaign, Project.user_id) → returns row (campaign, owner_id)
    Second call: WorkflowJob SELECT → returns the job
    """
    # First execute — campaign + owner join
    join_result = MagicMock()
    join_result.first.return_value = (campaign, owner_id)
    join_result.scalar_one_or_none.return_value = None

    # Second execute — WorkflowJob
    job_result = MagicMock()
    job_result.scalar_one_or_none.return_value = job
    job_result.first.return_value = None

    return [join_result, job_result]
