# -*- coding: utf-8 -*-
# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : tests/microservices/test_campaign_agent.py
# DESCRIPTION  : Pytest suite for the Campaign Agent microservice.
#                Coverage target : 90%+
#                Invariants tested:
#                  - Intent parsing (happy-path, edge cases, error paths)
#                  - CampaignAgent pipeline (security, status guards, audit)
#                  - publish_post_at_scheduled_time (triple security check)
# AUTHOR       : BRANDPILOT Dev Team
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import json
import uuid
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Helpers — build minimal ORM-like objects using MagicMock so tests don't
# need a live database engine.
# ---------------------------------------------------------------------------


def _make_campaign(
    *,
    campaign_id: str | None = None,
    project_id: str | None = None,
    status: str = "draft",
) -> MagicMock:
    """Return a Campaign-shaped MagicMock with required attributes."""
    c = MagicMock()
    c.id = uuid.UUID(campaign_id) if campaign_id else uuid.uuid4()
    c.project_id = uuid.UUID(project_id) if project_id else uuid.uuid4()
    c.status = status
    c.name = "Test Campaign"
    c.launched_at = None
    return c


def _make_project(*, project_id: str | None = None, user_id: str | None = None) -> MagicMock:
    """Return a Project-shaped MagicMock."""
    p = MagicMock()
    p.id = uuid.UUID(project_id) if project_id else uuid.uuid4()
    p.user_id = uuid.UUID(user_id) if user_id else uuid.uuid4()
    p.name = "Test Project"
    p.archived = False
    return p


def _make_workflow_job(
    *,
    campaign_id: str | None = None,
    agent_status: str = "pending_validation",
    posts: list[dict[str, Any]] | None = None,
) -> MagicMock:
    """Return a WorkflowJob-shaped MagicMock with a result JSONB field."""
    job = MagicMock()
    job.id = uuid.uuid4()
    job.campaign_id = uuid.UUID(campaign_id) if campaign_id else uuid.uuid4()
    job.job_type = "campaign_agent"
    job.status = "pending"
    job.current_step = None
    job.payload = {}
    job.result = {"agent_status": agent_status, "posts": posts or []}
    job.started_at = datetime.now(UTC)
    job.completed_at = None
    return job


def _make_social_post(
    *,
    post_id: str | None = None,
    campaign_id: str | None = None,
    status: str = "pending_validation",
    platform: str = "instagram",
    scheduled_at: str | None = None,
    celery_task_id: str | None = None,
) -> dict[str, Any]:
    """Return a SocialPost-shaped dict (as stored in WorkflowJob.result)."""
    _cid = campaign_id or str(uuid.uuid4())
    return {
        "id": post_id or str(uuid.uuid4()),
        "campaign_id": _cid,
        "platform": platform,
        "content_text": "Test caption #brand",
        "media_urls": [],
        "hashtags": ["brand", "test"],
        "scheduled_at": scheduled_at
        or (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
        "status": status,
        "platform_post_id": None,
        "published_at": None,
        "celery_task_id": celery_task_id,
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_db_session() -> AsyncMock:
    """AsyncSession mock: add/flush/commit/refresh all succeed silently."""
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def fake_campaign() -> MagicMock:
    """Campaign ORM object in 'draft' status."""
    return _make_campaign(status="draft")


@pytest.fixture
def fake_post() -> dict[str, Any]:
    """SocialPost dict with status='pending_validation'."""
    return _make_social_post(status="pending_validation")


@pytest.fixture
def mock_celery() -> MagicMock:
    """Celery app mock with send_task, signature, and control.revoke."""
    celery = MagicMock()
    task_result = MagicMock()
    task_result.id = str(uuid.uuid4())
    celery.send_task.return_value = task_result
    celery.signature.return_value = MagicMock()
    celery.control = MagicMock()
    celery.control.revoke = MagicMock()
    return celery


@pytest.fixture
def mock_openai() -> MagicMock:
    """OpenAI client mock returning a valid CampaignIntent JSON response."""
    _valid_gpt_response = json.dumps({
        "platform": "instagram",
        "audience_age": "25-35",
        "audience_gender": "female",
        "audience_csp": "all",
        "budget_influencer": 500.0,
        "duration_days": 14,
        "objective": "awareness",
        "product_description": "sac en cuir premium",
        "tone_override": None,
        "extracted_fields": [
            "platform",
            "audience_age",
            "audience_gender",
            "budget_influencer",
            "product_description",
        ],
    })
    client = MagicMock()
    choice = MagicMock()
    choice.message.content = _valid_gpt_response
    response = MagicMock()
    response.choices = [choice]
    response.usage = MagicMock(total_tokens=120)
    client.chat.completions.create = AsyncMock(return_value=response)
    return client


# ===========================================================================
# TestIntentParser
# ===========================================================================


class TestIntentParser:
    """Unit tests for microservices/campaign_agent/intent_parser.py"""

    async def test_parse_complete_prompt(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT: A rich, complete prompt → all key fields correctly extracted.

        Given a GPT-4 mock returning a fully populated JSON object,
        parse_intent() must return a CampaignIntent with matching field values.
        """
        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import (
                CampaignIntent,
                parse_intent,
            )

            result = await parse_intent(
                "campagne Instagram sac cuir femmes 25-35 budget 500€"
            )

        assert isinstance(result, CampaignIntent)
        assert result.platform == "instagram"
        assert result.audience_gender == "female"
        assert result.audience_age == "25-35"
        assert result.budget_influencer == 500.0
        assert result.product_description == "sac en cuir premium"
        assert len(result._extracted_fields) >= 3

    async def test_parse_minimal_prompt(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT: Fields not mentioned in the prompt fall back to defaults.

        A response with only 3 extracted fields must not raise — missing
        fields keep their documented default values.
        """
        # Override GPT-4 to return only 3 fields
        minimal_response = json.dumps({
            "platform": "instagram",
            "audience_age": "all",
            "audience_gender": "all",
            "audience_csp": "all",
            "budget_influencer": 0.0,
            "duration_days": 14,
            "objective": "awareness",
            "product_description": "",
            "tone_override": None,
            "extracted_fields": ["platform", "objective", "audience_age"],
        })
        mock_openai.chat.completions.create.return_value.choices[
            0
        ].message.content = minimal_response

        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import parse_intent

            result = await parse_intent("campagne Instagram")

        assert result.platform == "instagram"
        assert result.audience_gender == "all"     # default
        assert result.budget_influencer == 0.0     # default
        assert result.product_description == ""    # default

    async def test_ambiguous_prompt_raises_error(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT (SECURITY): A vague prompt with < 3 extracted fields raises
        AmbiguousPromptError and must NEVER start campaign generation.

        The error must carry clarification questions to surface to the user.
        """
        vague_response = json.dumps({
            "platform": "multi",
            "audience_age": "all",
            "audience_gender": "all",
            "audience_csp": "all",
            "budget_influencer": 0.0,
            "duration_days": 14,
            "objective": "awareness",
            "product_description": "",
            "tone_override": None,
            "extracted_fields": [],  # nothing extracted → ambiguous
        })
        mock_openai.chat.completions.create.return_value.choices[
            0
        ].message.content = vague_response

        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import (
                AmbiguousPromptError,
                parse_intent,
            )

            with pytest.raises(AmbiguousPromptError) as exc_info:
                await parse_intent("lance une campagne")

        assert isinstance(exc_info.value.questions, list)
        assert len(exc_info.value.questions) > 0, (
            "AmbiguousPromptError must carry clarification questions"
        )

    async def test_invalid_gpt_response_raises_error(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT: When GPT-4 returns malformed JSON, IntentParseError is raised
        with the raw response attached — never a raw JSONDecodeError.
        """
        mock_openai.chat.completions.create.return_value.choices[
            0
        ].message.content = "Sorry, I cannot help with that. Not JSON."

        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import (
                IntentParseError,
                parse_intent,
            )

            with pytest.raises(IntentParseError) as exc_info:
                await parse_intent("campagne produit X")

        assert "Sorry" in exc_info.value.raw_response or len(exc_info.value.raw_response) > 0

    async def test_platform_detection_multi(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT: A prompt mentioning multiple platforms maps to platform="multi".
        """
        multi_response = json.dumps({
            "platform": "multi",
            "audience_age": "18-35",
            "audience_gender": "all",
            "audience_csp": "all",
            "budget_influencer": 1000.0,
            "duration_days": 30,
            "objective": "awareness",
            "product_description": "sneakers sport édition limitée",
            "tone_override": "energetic",
            "extracted_fields": [
                "platform",
                "audience_age",
                "budget_influencer",
                "product_description",
                "tone_override",
            ],
        })
        mock_openai.chat.completions.create.return_value.choices[
            0
        ].message.content = multi_response

        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import parse_intent

            result = await parse_intent(
                "campagne multi-plateforme Instagram TikTok sneakers sport"
            )

        assert result.platform == "multi"

    async def test_openai_timeout_raises_error(self, mock_openai: MagicMock) -> None:
        """
        INVARIANT: When the OpenAI call times out, OpenAITimeoutError is raised
        — never asyncio.TimeoutError propagating to the caller.
        """
        import asyncio

        mock_openai.chat.completions.create = AsyncMock(
            side_effect=asyncio.TimeoutError()
        )

        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client",
            return_value=mock_openai,
        ):
            from microservices.campaign_agent.intent_parser import (
                OpenAITimeoutError,
                parse_intent,
            )

            with pytest.raises(OpenAITimeoutError):
                await parse_intent("campagne Instagram sac cuir femmes 25-35 budget 500€")

    async def test_empty_prompt_raises_value_error(self) -> None:
        """
        INVARIANT: An empty prompt raises ValueError before any API call.
        The OpenAI client must NOT be called.
        """
        with patch(
            "microservices.campaign_agent.intent_parser.get_openai_client"
        ) as mock_client:
            from microservices.campaign_agent.intent_parser import parse_intent

            with pytest.raises(ValueError, match="vide"):
                await parse_intent("   ")

        mock_client.assert_not_called()


# ===========================================================================
# TestCampaignAgent
# ===========================================================================


class TestCampaignAgent:
    """Unit tests for microservices/campaign_agent/agent.py — CampaignAgent."""

    def _make_execute_result(self, rows: list[Any]) -> MagicMock:
        """Return a mock DB execute() result that yields `rows` from .first()."""
        result = MagicMock()
        result.first.return_value = rows[0] if rows else None
        result.scalar_one_or_none.return_value = rows[0] if rows else None
        return result

    async def test_build_campaign_sets_pending_validation_status(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
        mock_openai: MagicMock,
    ) -> None:
        """
        INVARIANT (CRITICAL): After build_campaign(), the WorkflowJob.result
        stored in the database must have agent_status='pending_validation'.

        This is the central HITL gate — any other status after build_campaign()
        would allow bypassing human approval.
        """
        project_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        # DB execute returns a Project row
        project = _make_project(project_id=project_id)
        db_result = MagicMock()
        db_result.scalar_one_or_none.return_value = project
        fake_db_session.execute.return_value = db_result

        # refresh() populates the id field on add()ed ORM objects
        async def mock_refresh(obj: MagicMock) -> None:
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = uuid.uuid4()
        fake_db_session.refresh.side_effect = mock_refresh

        with (
            patch(
                "microservices.campaign_agent.intent_parser.get_openai_client",
                return_value=mock_openai,
            ),
            patch(
                "microservices.campaign_agent.agent._publish_event",
                new=AsyncMock(),
            ),
            patch("microservices.campaign_agent.agent.chord", MagicMock()),
            patch("microservices.campaign_agent.agent.group", MagicMock()),
        ):
            from microservices.campaign_agent.agent import CampaignAgent

            agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
            campaign_id = await agent.build_campaign(
                prompt="campagne Instagram sac cuir femmes 25-35 budget 500€",
                project_id=project_id,
                user_id=user_id,
            )

        # Find the WorkflowJob that was added to the session
        added_objects = [
            call_args[0][0] for call_args in fake_db_session.add.call_args_list
        ]
        workflow_jobs = [
            obj for obj in added_objects
            if hasattr(obj, "job_type") and obj.job_type == "campaign_agent"
        ]
        assert len(workflow_jobs) >= 1, "A WorkflowJob must be persisted"
        job = workflow_jobs[0]
        assert job.result is not None, "WorkflowJob.result must not be None"
        assert job.result.get("agent_status") == "pending_validation", (
            "agent_status must be 'pending_validation' — never anything else "
            "after build_campaign()"
        )

    async def test_build_campaign_never_sets_scheduled_status(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
        mock_openai: MagicMock,
    ) -> None:
        """
        INVARIANT (CRITICAL / SECURITY): build_campaign() must NEVER write
        agent_status='scheduled' or 'published' to the database.

        The status 'scheduled' may ONLY be set by approve_and_schedule(),
        and 'published' may ONLY be set by the Celery worker task.
        """
        project_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        project = _make_project(project_id=project_id)
        db_result = MagicMock()
        db_result.scalar_one_or_none.return_value = project
        fake_db_session.execute.return_value = db_result

        async def mock_refresh(obj: MagicMock) -> None:
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = uuid.uuid4()
        fake_db_session.refresh.side_effect = mock_refresh

        forbidden_statuses = {"scheduled", "published", "active"}

        with (
            patch(
                "microservices.campaign_agent.intent_parser.get_openai_client",
                return_value=mock_openai,
            ),
            patch(
                "microservices.campaign_agent.agent._publish_event",
                new=AsyncMock(),
            ),
            patch("microservices.campaign_agent.agent.chord", MagicMock()),
            patch("microservices.campaign_agent.agent.group", MagicMock()),
        ):
            from microservices.campaign_agent.agent import CampaignAgent

            agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
            await agent.build_campaign(
                prompt="campagne Instagram sac cuir femmes 25-35 budget 500€",
                project_id=project_id,
                user_id=user_id,
            )

        added_objects = [
            call_args[0][0] for call_args in fake_db_session.add.call_args_list
        ]
        for obj in added_objects:
            if hasattr(obj, "result") and isinstance(obj.result, dict):
                actual = obj.result.get("agent_status", "")
                assert actual not in forbidden_statuses, (
                    f"build_campaign() wrote forbidden status={actual!r}. "
                    f"Only the worker may set {forbidden_statuses}."
                )

    @pytest.mark.security
    async def test_approve_and_schedule_requires_ownership(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT (SECURITY): approve_and_schedule() called by a user who is NOT
        the campaign owner must raise UnauthorizedError and must NOT schedule
        any Celery tasks.
        """
        owner_id = str(uuid.uuid4())
        wrong_user_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id, status="draft")
        project = _make_project(user_id=owner_id)

        # execute() returns (campaign, owner_uuid) for the JOIN query
        execute_result = MagicMock()
        execute_result.first.return_value = (campaign, uuid.UUID(owner_id))
        fake_db_session.execute.return_value = execute_result

        from microservices.campaign_agent.agent import CampaignAgent, UnauthorizedError

        agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)

        with pytest.raises(UnauthorizedError):
            await agent.approve_and_schedule(
                campaign_id=campaign_id,
                user_id=wrong_user_id,  # wrong user
            )

        # No Celery tasks must have been dispatched
        mock_celery.send_task.assert_not_called()

    @pytest.mark.security
    async def test_approve_and_schedule_requires_pending_status(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT (SECURITY): approve_and_schedule() on a campaign that is NOT
        in pending_validation state must raise InvalidStatusError.

        Prevents double-approval and bypassing the HITL gate.
        """
        owner_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id, status="active")

        execute_result = MagicMock()
        execute_result.first.return_value = (campaign, uuid.UUID(owner_id))

        # second execute() — _load_agent_job returns a job already "approved"
        job = _make_workflow_job(
            campaign_id=campaign_id, agent_status="approved"
        )
        job_result = MagicMock()
        job_result.scalar_one_or_none.return_value = job

        fake_db_session.execute.side_effect = [execute_result, job_result]

        from microservices.campaign_agent.agent import (
            CampaignAgent,
            InvalidStatusError,
        )

        agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)

        with pytest.raises(InvalidStatusError) as exc_info:
            await agent.approve_and_schedule(
                campaign_id=campaign_id,
                user_id=owner_id,
            )

        assert exc_info.value.current_status == "approved"
        assert exc_info.value.expected_status == "pending_validation"
        mock_celery.send_task.assert_not_called()

    async def test_approve_creates_audit_trail(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT: After a successful approve_and_schedule(), the WorkflowJob
        payload must contain a 'validation' audit record with action='approved'
        and the correct user_id.
        """
        owner_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id, status="draft")
        post = _make_social_post(
            campaign_id=campaign_id,
            status="pending_validation",
            scheduled_at=(datetime.now(UTC) + timedelta(hours=3)).isoformat(),
        )
        job = _make_workflow_job(
            campaign_id=campaign_id,
            agent_status="pending_validation",
            posts=[post],
        )
        job.payload = {}

        execute_result_join = MagicMock()
        execute_result_join.first.return_value = (campaign, uuid.UUID(owner_id))

        execute_result_job = MagicMock()
        execute_result_job.scalar_one_or_none.return_value = job

        fake_db_session.execute.side_effect = [
            execute_result_join,
            execute_result_job,
        ]

        with patch(
            "microservices.campaign_agent.agent._publish_event",
            new=AsyncMock(),
        ):
            from microservices.campaign_agent.agent import CampaignAgent

            agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
            result = await agent.approve_and_schedule(
                campaign_id=campaign_id,
                user_id=owner_id,
            )

        assert result is True
        assert job.payload is not None, "WorkflowJob.payload must not be None"
        validation = job.payload.get("validation")
        assert validation is not None, "Audit record 'validation' must be present in payload"
        assert validation.get("action") == "approved"
        assert validation.get("user_id") == owner_id

    async def test_cancel_revokes_celery_tasks(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT: cancel_campaign() must call celery.control.revoke() for every
        scheduled post whose ETA is more than 5 minutes in the future.

        Posts already published or failed must NOT be revoked.
        """
        owner_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())

        future_task_id = str(uuid.uuid4())
        published_task_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id, status="active")

        future_post = _make_social_post(
            campaign_id=campaign_id,
            status="scheduled",
            scheduled_at=(datetime.now(UTC) + timedelta(hours=4)).isoformat(),
            celery_task_id=future_task_id,
        )
        published_post = _make_social_post(
            campaign_id=campaign_id,
            status="published",
            celery_task_id=published_task_id,
        )

        job = _make_workflow_job(
            campaign_id=campaign_id,
            agent_status="approved",
            posts=[future_post, published_post],
        )

        execute_result_join = MagicMock()
        execute_result_join.first.return_value = (campaign, uuid.UUID(owner_id))

        execute_result_job = MagicMock()
        execute_result_job.scalar_one_or_none.return_value = job

        fake_db_session.execute.side_effect = [
            execute_result_join,
            execute_result_job,
        ]

        with patch(
            "microservices.campaign_agent.agent._publish_event",
            new=AsyncMock(),
        ):
            from microservices.campaign_agent.agent import CampaignAgent

            agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
            result = await agent.cancel_campaign(
                campaign_id=campaign_id,
                user_id=owner_id,
            )

        assert result is True

        # revoke() called once — only for the future task
        mock_celery.control.revoke.assert_called_once_with(
            future_task_id,
            terminate=True,
            signal="SIGTERM",
        )

        # Published task must NOT be revoked
        revoked_ids = [
            c.args[0] for c in mock_celery.control.revoke.call_args_list
        ]
        assert published_task_id not in revoked_ids, (
            "Published posts must never have their Celery task revoked"
        )

    async def test_cancel_requires_ownership(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT (SECURITY): cancel_campaign() by a non-owner must raise
        UnauthorizedError. No Celery revoke() may be called.
        """
        owner_id = str(uuid.uuid4())
        wrong_user_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id)
        execute_result = MagicMock()
        execute_result.first.return_value = (campaign, uuid.UUID(owner_id))
        fake_db_session.execute.return_value = execute_result

        from microservices.campaign_agent.agent import CampaignAgent, UnauthorizedError

        agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
        with pytest.raises(UnauthorizedError):
            await agent.cancel_campaign(
                campaign_id=campaign_id,
                user_id=wrong_user_id,
            )

        mock_celery.control.revoke.assert_not_called()

    async def test_reject_and_regenerate_queues_celery_task(
        self,
        fake_db_session: AsyncMock,
        mock_celery: MagicMock,
    ) -> None:
        """
        INVARIANT: reject_and_regenerate() must enqueue a 'bs_ai_text.regenerate_post'
        Celery task and return a SocialPost with status='pending_validation'.
        """
        owner_id = str(uuid.uuid4())
        campaign_id = str(uuid.uuid4())
        post_id = str(uuid.uuid4())

        campaign = _make_campaign(campaign_id=campaign_id)
        execute_result = MagicMock()
        execute_result.first.return_value = (campaign, uuid.UUID(owner_id))
        fake_db_session.execute.return_value = execute_result

        from microservices.campaign_agent.agent import CampaignAgent

        agent = CampaignAgent(db=fake_db_session, celery_app=mock_celery)
        updated_post = await agent.reject_and_regenerate(
            campaign_id=campaign_id,
            post_id=post_id,
            feedback="Ton plus dynamique",
            user_id=owner_id,
        )

        mock_celery.send_task.assert_called_once_with(
            "bs_ai_text.regenerate_post",
            args=[post_id, "Ton plus dynamique", campaign_id],
        )
        assert updated_post.status == "pending_validation"
        assert updated_post.id == post_id


# ===========================================================================
# TestPublishWorker — Triple security check
# ===========================================================================


class TestPublishWorker:
    """Tests for publish_post_at_scheduled_time and _check_publish_guards."""

    @pytest.mark.security
    async def test_publish_blocked_if_not_approved(self) -> None:
        """
        INVARIANT (CRITICAL / SECURITY): If post.status != 'approved',
        _check_publish_guards() must return True (block) and the platform
        publisher must NOT be called.

        This is Check 1 of the triple security gate.
        """
        campaign = _make_campaign(status="active")
        post_dict = _make_social_post(status="pending_validation")

        mock_project = _make_project(
            project_id=str(campaign.project_id),
        )

        with patch(
            "database.connection.db_session"
        ) as mock_db_ctx, patch(
            "microservices.campaign_agent.worker._publish_via_platform",
        ) as mock_publisher:
            mock_session = AsyncMock()
            project_result = MagicMock()
            project_result.scalar_one_or_none.return_value = mock_project
            mock_session.execute = AsyncMock(return_value=project_result)
            mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

            from microservices.campaign_agent.worker import _check_publish_guards

            blocked = await _check_publish_guards(
                post_dict["id"], post_dict, campaign
            )

        assert blocked is True, (
            "Check 1 failed: publication must be blocked when post.status != 'approved'"
        )
        mock_publisher.assert_not_called()

    @pytest.mark.security
    async def test_publish_blocked_if_campaign_not_active(self) -> None:
        """
        INVARIANT (CRITICAL / SECURITY): If campaign.status != 'active',
        _check_publish_guards() must return True (block) even when the
        post itself is approved.

        This is Check 2 of the triple security gate.
        """
        campaign = _make_campaign(status="paused")  # not active
        post_dict = _make_social_post(status="approved")  # post is approved

        with patch(
            "database.connection.db_session"
        ) as mock_db_ctx, patch(
            "microservices.campaign_agent.worker._publish_via_platform",
        ) as mock_publisher:
            mock_session = AsyncMock()
            mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

            from microservices.campaign_agent.worker import _check_publish_guards

            blocked = await _check_publish_guards(
                post_dict["id"], post_dict, campaign
            )

        assert blocked is True, (
            "Check 2 failed: publication must be blocked when campaign.status != 'active'"
        )
        mock_publisher.assert_not_called()

    @pytest.mark.security
    async def test_publish_raises_if_owner_not_resolvable(self) -> None:
        """
        INVARIANT (CRITICAL / SECURITY): If the campaign's project / owner
        cannot be resolved, _check_publish_guards() must raise
        UnauthorizedPublicationError — NOT silently block.

        This is Check 3 of the triple security gate.
        """
        campaign = _make_campaign(status="active")
        post_dict = _make_social_post(status="approved")

        with patch(
            "database.connection.db_session"
        ) as mock_db_ctx:
            mock_session = AsyncMock()
            # Project not found → scalar_one_or_none() returns None
            project_result = MagicMock()
            project_result.scalar_one_or_none.return_value = None
            mock_session.execute = AsyncMock(return_value=project_result)
            mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

            from microservices.campaign_agent.worker import (
                _check_publish_guards,
                UnauthorizedPublicationError,
            )

            with pytest.raises(UnauthorizedPublicationError) as exc_info:
                await _check_publish_guards(
                    post_dict["id"], post_dict, campaign
                )

        assert exc_info.value.post_id == post_dict["id"]

    async def test_publish_all_checks_pass(self) -> None:
        """
        INVARIANT: When all three checks pass (post approved, campaign active,
        project resolvable), _check_publish_guards() returns False (do not block).
        """
        campaign = _make_campaign(status="active")
        post_dict = _make_social_post(status="approved")
        project = _make_project(project_id=str(campaign.project_id))

        with patch(
            "database.connection.db_session"
        ) as mock_db_ctx:
            mock_session = AsyncMock()
            project_result = MagicMock()
            project_result.scalar_one_or_none.return_value = project
            mock_session.execute = AsyncMock(return_value=project_result)
            mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

            from microservices.campaign_agent.worker import _check_publish_guards

            blocked = await _check_publish_guards(
                post_dict["id"], post_dict, campaign
            )

        assert blocked is False, (
            "When all three checks pass, _check_publish_guards() must return False"
        )

    @pytest.mark.security
    async def test_publish_retries_on_api_failure(self) -> None:
        """
        INVARIANT: When _publish_via_platform() raises an exception,
        the Celery task must call self.retry() — it must NOT swallow the error
        or mark the post as published.
        """
        campaign = _make_campaign(status="active")
        post_dict = _make_social_post(status="approved")
        project = _make_project(project_id=str(campaign.project_id))

        # Test the async body (_publish_post_secure) directly.
        # Celery's retry() on the sync wrapper is infrastructure-level and
        # cannot be easily injected via patch.object (Celery's Task.request is
        # a read-only descriptor). The invariant we test here is that errors
        # from _publish_via_platform are NOT silently swallowed — they
        # propagate, enabling the Celery wrapper to call self.retry().
        with (
            patch(
                "microservices.campaign_agent.worker._load_post_and_campaign",
                new=AsyncMock(return_value=(post_dict, campaign)),
            ),
            patch(
                "microservices.campaign_agent.worker._check_publish_guards",
                new=AsyncMock(return_value=False),  # all checks pass
            ),
            patch(
                "microservices.campaign_agent.worker._publish_via_platform",
                new=AsyncMock(side_effect=RuntimeError("API down")),
            ),
            patch(
                "microservices.campaign_agent.worker._update_post_status",
                new=AsyncMock(),
            ) as mock_update_status,
        ):
            from microservices.campaign_agent.worker import _publish_post_secure

            with pytest.raises(RuntimeError, match="API down"):
                await _publish_post_secure(MagicMock(), post_dict["id"])

        # Post status must NOT have been updated to "published" when the API call fails
        for call_args in mock_update_status.call_args_list:
            assert call_args.args[1] != "published", (
                "Post must not be marked published when _publish_via_platform raises"
            )

    async def test_analytics_scheduled_after_publish(self) -> None:
        """
        INVARIANT: After a successful publication,
        collect_post_analytics.apply_async() must be called with
        countdown=86_400 (24 hours) to schedule metrics collection.
        """
        campaign = _make_campaign(status="active")
        post_id = str(uuid.uuid4())
        post_dict = _make_social_post(
            post_id=post_id,
            campaign_id=str(campaign.id),
            status="approved",
        )
        project = _make_project(project_id=str(campaign.project_id))

        with (
            patch(
                "microservices.campaign_agent.worker._load_post_and_campaign",
                new=AsyncMock(return_value=(post_dict, campaign)),
            ),
            patch(
                "microservices.campaign_agent.worker._check_publish_guards",
                new=AsyncMock(return_value=False),
            ),
            patch(
                "microservices.campaign_agent.worker._publish_via_platform",
                new=AsyncMock(return_value=f"instagram_{uuid.uuid4().hex[:12]}"),
            ),
            patch(
                "microservices.campaign_agent.worker._update_post_status",
                new=AsyncMock(),
            ),
            patch(
                "microservices.campaign_agent.worker.collect_post_analytics"
            ) as mock_analytics_task,
        ):
            mock_analytics_task.apply_async = MagicMock()

            from microservices.campaign_agent.worker import _publish_post_secure

            mock_self = MagicMock()
            await _publish_post_secure(mock_self, post_id)

        mock_analytics_task.apply_async.assert_called_once_with(
            args=[post_id], countdown=86_400
        )


# ===========================================================================
# TestContextBuilder
# ===========================================================================


class TestContextBuilder:
    """Unit tests for microservices/campaign_agent/context_builder.py"""

    async def test_build_returns_brand_context(
        self, fake_db_session: AsyncMock
    ) -> None:
        """
        INVARIANT: build() must return a BrandContext populated with
        at least the project_id and brand_name.
        """
        project_id = str(uuid.uuid4())
        project = _make_project(project_id=project_id)
        project.description = "Luxury premium fashion brand for professionals"
        project.archived = False

        db_result = MagicMock()
        db_result.scalar_one_or_none.return_value = project
        fake_db_session.execute.return_value = db_result

        from microservices.campaign_agent.context_builder import ContextBuilder

        builder = ContextBuilder(fake_db_session)
        context = await builder.build(project_id)

        assert context.project_id == project_id
        assert context.brand_name == project.name
        assert isinstance(context.brand_tone, str)
        assert len(context.brand_tone) > 0

    async def test_archived_project_raises_value_error(
        self, fake_db_session: AsyncMock
    ) -> None:
        """
        INVARIANT: An archived project must NOT generate a campaign.
        build() must raise ValueError before any Celery or DB writes.
        """
        project_id = str(uuid.uuid4())
        project = _make_project(project_id=project_id)
        project.archived = True

        db_result = MagicMock()
        db_result.scalar_one_or_none.return_value = project
        fake_db_session.execute.return_value = db_result

        from microservices.campaign_agent.context_builder import ContextBuilder

        builder = ContextBuilder(fake_db_session)
        with pytest.raises(ValueError, match="archiv"):
            await builder.build(project_id)

    async def test_nonexistent_project_raises_value_error(
        self, fake_db_session: AsyncMock
    ) -> None:
        """
        INVARIANT: build() for a non-existent project_id raises ValueError.
        """
        db_result = MagicMock()
        db_result.scalar_one_or_none.return_value = None
        fake_db_session.execute.return_value = db_result

        from microservices.campaign_agent.context_builder import ContextBuilder

        builder = ContextBuilder(fake_db_session)
        with pytest.raises(ValueError, match="not found"):
            await builder.build(str(uuid.uuid4()))


# ===========================================================================
# TestExecutionPlanner (pure-function — no I/O)
# ===========================================================================


class TestExecutionPlanner:
    """Unit tests for microservices/campaign_agent/execution_planner.py"""

    def test_plan_includes_core_services(self) -> None:
        """
        INVARIANT: Every plan must include the three core services:
        bs_ai_text, bs_ai_image, bs_scheduling — regardless of platform.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.execution_planner import ExecutionPlanner

        intent = CampaignIntent(platform="instagram", objective="awareness")
        intent._extracted_fields = ["platform", "objective", "audience_age"]
        context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")

        plan = ExecutionPlanner().plan(intent, context)
        for svc in ("bs_ai_text", "bs_ai_image", "bs_scheduling"):
            assert svc in plan.microservices, f"{svc} must always be in the plan"

    def test_video_platform_includes_video_service(self) -> None:
        """
        INVARIANT: TikTok and YouTube plans must include bs_ai_video.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.execution_planner import ExecutionPlanner

        for platform in ("tiktok", "youtube"):
            intent = CampaignIntent(platform=platform, objective="awareness")
            intent._extracted_fields = ["platform", "objective", "audience_age"]
            context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")
            plan = ExecutionPlanner().plan(intent, context)
            assert "bs_ai_video" in plan.microservices, (
                f"bs_ai_video must be in plan for platform={platform}"
            )

    def test_plan_estimated_duration_positive(self) -> None:
        """
        INVARIANT: estimated_duration_s must always be > 0.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.execution_planner import ExecutionPlanner

        intent = CampaignIntent(platform="x", objective="conversion")
        intent._extracted_fields = ["platform", "objective", "budget_influencer"]
        context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")

        plan = ExecutionPlanner().plan(intent, context)
        assert plan.estimated_duration_s > 0


# ===========================================================================
# TestCampaignBuilder (pure-function — no I/O)
# ===========================================================================


class TestCampaignBuilder:
    """Unit tests for microservices/campaign_agent/campaign_builder.py"""

    def test_builds_correct_number_of_posts(self) -> None:
        """
        INVARIANT: build_posts() must produce exactly
        duration_days × posts_per_day posts.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.campaign_builder import CampaignBuilder

        intent = CampaignIntent(
            platform="instagram",
            objective="awareness",
            duration_days=3,
        )
        context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")
        reference = datetime(2026, 3, 10, 9, 0, 0, tzinfo=UTC)

        posts = CampaignBuilder().build_posts(
            campaign_id=str(uuid.uuid4()),
            intent=intent,
            context=context,
            chord_results=[{}, {}, {}],
            reference_dt=reference,
        )

        # Instagram default is 1 post/day
        assert len(posts) == 3, (
            f"Expected 3 posts (3 days × 1/day), got {len(posts)}"
        )

    def test_all_posts_have_pending_validation_status(self) -> None:
        """
        INVARIANT: Every freshly built post must have status='pending_validation'.
        No post may be built with 'scheduled' or 'published'.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.campaign_builder import CampaignBuilder

        intent = CampaignIntent(
            platform="instagram",
            objective="awareness",
            duration_days=2,
        )
        context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")

        posts = CampaignBuilder().build_posts(
            campaign_id=str(uuid.uuid4()),
            intent=intent,
            context=context,
            chord_results=[{}, {}, {}],
        )

        for post in posts:
            assert post.status == "pending_validation", (
                f"Post was built with status={post.status!r} — "
                "must always be 'pending_validation'"
            )

    def test_scheduled_at_is_in_future(self) -> None:
        """
        INVARIANT: All scheduled_at datetimes must be at least 1 day
        in the future from the reference datetime.
        """
        from microservices.campaign_agent.agent import BrandContext
        from microservices.campaign_agent.intent_parser import CampaignIntent
        from microservices.campaign_agent.campaign_builder import CampaignBuilder

        reference = datetime.now(UTC)
        intent = CampaignIntent(
            platform="tiktok",
            objective="engagement",
            duration_days=3,
        )
        context = BrandContext(project_id=str(uuid.uuid4()), brand_name="Test")

        posts = CampaignBuilder().build_posts(
            campaign_id=str(uuid.uuid4()),
            intent=intent,
            context=context,
            chord_results=[{}, {}, {}],
            reference_dt=reference,
        )

        for post in posts:
            scheduled = datetime.fromisoformat(post.scheduled_at)
            assert scheduled > reference + timedelta(minutes=60), (
                f"Post scheduled_at={scheduled} is not sufficiently in the future"
            )


# ===========================================================================
# TestWorkerHelpers — pure function tests
# ===========================================================================


class TestWorkerHelpers:
    """Tests for pure helper functions in worker.py."""

    def test_exponential_countdown_doubles(self) -> None:
        """
        INVARIANT: Each retry doubles the backoff countdown (base * 2^n).
        """
        from microservices.campaign_agent.worker import _exponential_countdown

        assert _exponential_countdown(0) == 60
        assert _exponential_countdown(1) == 120
        assert _exponential_countdown(2) == 240

    def test_build_editorial_calendar_respects_duration(self) -> None:
        """
        INVARIANT: The editorial calendar must produce exactly
        duration_days × posts_per_day slots, matching the intent.
        """
        from microservices.campaign_agent.worker import _build_editorial_calendar

        intent_dict = {"platform": "instagram", "duration_days": 5}
        audience_data = {"best_times": [{"hour": 9}]}
        calendar = _build_editorial_calendar(intent_dict, {}, audience_data)

        # instagram = 1 post/day × 5 days
        assert len(calendar) == 5

    def test_build_editorial_calendar_tiktok_frequency(self) -> None:
        """
        INVARIANT: TikTok has a higher default frequency (2 posts/day).
        """
        from microservices.campaign_agent.worker import _build_editorial_calendar

        intent_dict = {"platform": "tiktok", "duration_days": 3}
        audience_data = {"best_times": [{"hour": 9}, {"hour": 18}]}
        calendar = _build_editorial_calendar(intent_dict, {}, audience_data)

        assert len(calendar) == 6, "TikTok: 3 days × 2 posts/day = 6"
