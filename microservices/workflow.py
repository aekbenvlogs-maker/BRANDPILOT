# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/workflow.py
# DESCRIPTION  : Full L2C pipeline orchestration via Celery chains
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
import uuid

from celery import Celery, chain, group
from celery.schedules import crontab
from database.connection import db_session
from database.models_orm import Campaign, Lead, ScoringWeights, WorkflowJob
from loguru import logger
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from configs.alerting import send_alert
from configs.settings import get_settings
from microservices.bs_ai_image.worker import task_generate_image
from microservices.bs_ai_text.worker import task_generate_post
from microservices.bs_email.worker import task_create_sequence
from microservices.bs_scoring.worker import task_rank_leads, task_score_lead

settings = get_settings()

# Public name required for Celery -A auto-discovery
celery_app = Celery(
    "workflow",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Paris",
    enable_utc=True,
)

# Celery Beat schedule — periodic tasks (purge RGPD, analytics aggregation)
celery_app.conf.beat_schedule = {
    "rgpd-lead-purge": {
        "task": "brandscale.purge_expired_leads",
        "schedule": crontab(hour=2, minute=0),  # 02:00 UTC daily
    },
}


class BudgetExceededError(Exception):
    """Raised when a campaign's AI budget has been fully consumed."""


# ─── helpers ──────────────────────────────────────────────────────────────────


async def _create_job(job_type: str, payload: dict[str, Any]) -> str:
    """Persist a WorkflowJob record and return its ID."""
    job_id = str(uuid.uuid4())
    async with db_session() as session:
        job = WorkflowJob(
            id=job_id,
            job_type=job_type,
            status="pending",
            payload=payload,
            created_at=datetime.now(UTC),
        )
        session.add(job)
        await session.commit()
    return job_id


async def _update_job_status(job_id: str, status: str, result: Any = None) -> None:
    """Update a WorkflowJob status and optional result."""
    async with db_session() as session:
        values: dict[str, Any] = {"status": status}
        if result is not None:
            values["result"] = result
        await session.execute(
            update(WorkflowJob).where(WorkflowJob.id == job_id).values(**values)
        )
        await session.commit()
    logger.info("[workflow] Job {} → {}", job_id, status)


# ─── Lead Pipeline ────────────────────────────────────────────────────────────


async def _check_campaign_budget(campaign_id: str, session: AsyncSession) -> None:
    """Raise BudgetExceededError if the campaign's AI budget is exhausted."""
    result = await session.execute(
        select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
    )
    campaign = result.scalar_one_or_none()
    if (
        campaign
        and campaign.ai_budget_usd
        and float(campaign.ai_spent_usd) >= float(campaign.ai_budget_usd)
    ):
        raise BudgetExceededError(
            f"Campaign {campaign_id}: AI budget exhausted "
            f"({campaign.ai_spent_usd}$ / {campaign.ai_budget_usd}$)"
        )
    # Alert at 80% threshold
    if (
        campaign
        and campaign.ai_budget_usd
        and float(campaign.ai_spent_usd) >= 0.8 * float(campaign.ai_budget_usd)
    ):
        ratio = float(campaign.ai_spent_usd) / float(campaign.ai_budget_usd)
        await send_alert(
            f"Campaign {campaign_id}: {ratio:.0%} of AI budget consumed "
            f"({campaign.ai_spent_usd}$ / {campaign.ai_budget_usd}$)",
            level="warning",
        )


async def _adjust_scoring_weights(
    session: AsyncSession,
    project_id: uuid.UUID,
    delta: dict[str, float],
) -> None:
    """
    Adjust scoring dimension weights by delta, clamped to [0.05, 0.70].

    Args:
        session:    Async DB session.
        project_id: Project UUID.
        delta:      Dict of field → adjustment (e.g. {'engagement_w': +0.05}).
    """
    result = await session.execute(
        select(ScoringWeights).where(ScoringWeights.project_id == project_id)
    )
    weights = result.scalar_one_or_none()
    if weights is None:
        weights = ScoringWeights(project_id=project_id)
        session.add(weights)
    for field, change in delta.items():
        current = getattr(weights, field, None)
        if current is not None:
            new_val = max(0.05, min(0.70, float(current) + change))
            setattr(weights, field, new_val)
    weights.updated_by = "feedback_loop"
    await session.commit()
    logger.info(
        "[workflow] Scoring weights adjusted | project={} delta={}", project_id, delta
    )


async def run_lead_pipeline(leads: list[dict[str, Any]], campaign_id: str) -> str:
    """
    Lead Pipeline: import → score → classify → rank → persist.

    Steps:
    1. Score each lead individually (parallel group).
    2. Rank all leads by score.
    3. Persist scores to workflow_jobs.

    Args:
        leads:       List of raw lead dicts.
        campaign_id: Campaign context identifier.

    Returns:
        Workflow job ID.
    """
    job_id = await _create_job(
        "lead_pipeline", {"campaign_id": campaign_id, "count": len(leads)}
    )
    logger.info("[workflow] Lead pipeline start | job={} leads={}", job_id, len(leads))
    try:
        scoring_tasks = group(task_score_lead.s(lead) for lead in leads)
        pipeline = chain(scoring_tasks, task_rank_leads.s())
        pipeline.apply_async()
        await _update_job_status(job_id, "running")
    except Exception as exc:
        logger.error("[workflow] Lead pipeline error | job={} | {}", job_id, str(exc))
        await _update_job_status(job_id, "failed", str(exc))
    return job_id


# ─── Campaign Pipeline ────────────────────────────────────────────────────────


async def run_campaign_pipeline(
    campaign_data: dict[str, Any],
    leads: list[dict[str, Any]],
    template_html: str,
) -> str:
    """
    Campaign Pipeline: generate content → create visuals → email sequence → launch.

    Steps:
    1. Generate text posts (parallel).
    2. Generate marketing image.
    3. Create email sequence for opted-in leads.
    4. Send each email.

    Args:
        campaign_data: Campaign metadata.
        leads:         List of opted-in lead dicts.
        template_html: HTML email template.

    Returns:
        Workflow job ID.
    """
    job_id = await _create_job(
        "campaign_pipeline", {"campaign": campaign_data.get("id")}
    )
    logger.info("[workflow] Campaign pipeline start | job={}", job_id)
    try:
        # Budget preflight — abort before dispatching any API calls
        cid = campaign_data.get("id")
        if cid:
            async with db_session() as session:
                await _check_campaign_budget(str(cid), session)
        content_tasks = group(
            task_generate_post.s(
                lead.get("sector", "B2B"),
                campaign_data.get("tone", "professional"),
                campaign_data.get("platform", "linkedin"),
                campaign_data.get("language", "fr"),
                None,  # campaign_id passed via chain context
                lead.get("sector", "other"),
                lead.get("company", ""),
                lead.get("company_size", ""),
                lead.get("score_tier", ""),
            )
            for lead in leads[:5]  # generate up to 5 personalised posts
        )
        image_task = task_generate_image.s(
            prompt=f"Marketing visual for {campaign_data.get('name', 'campaign')}",
            style="professional",
        )
        sequence_task = task_create_sequence.s(campaign_data, leads, template_html)
        content_tasks.apply_async()
        image_task.apply_async()
        sequence_task.apply_async()
        await _update_job_status(job_id, "running")
    except Exception as exc:
        logger.error(
            "[workflow] Campaign pipeline error | job={} | {}", job_id, str(exc)
        )
        await _update_job_status(job_id, "failed", str(exc))
    return job_id


# ─── Feedback Loop ────────────────────────────────────────────────────────────


async def run_feedback_loop(campaign_id: str, kpis: dict[str, Any]) -> str:
    """
    Feedback Loop: collect KPIs → analyse → adjust scoring weights.

    Args:
        campaign_id: Campaign identifier.
        kpis:        Engagement KPI dict (open_rate, click_rate, conversion_rate).

    Returns:
        Workflow job ID.
    """
    job_id = await _create_job(
        "feedback_loop", {"campaign_id": campaign_id, "kpis": kpis}
    )
    logger.info("[workflow] Feedback loop start | job={} | kpis={}", job_id, kpis)
    try:
        open_rate = float(kpis.get("open_rate", 0))
        click_rate = float(kpis.get("click_rate", 0))
        conversion_rate = float(kpis.get("conversion_rate", 0))
        analysis = {
            "campaign_id": campaign_id,
            "performance_tier": (
                "high"
                if conversion_rate > 0.05
                else "medium" if conversion_rate > 0.02 else "low"
            ),
            "open_rate": open_rate,
            "click_rate": click_rate,
            "conversion_rate": conversion_rate,
            "recommendations": _build_recommendations(
                open_rate, click_rate, conversion_rate
            ),
        }

        # Fetch project_id from campaign to update scoring weights
        async with db_session() as session:
            camp_result = await session.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            )
            campaign = camp_result.scalar_one_or_none()
            if campaign and analysis["performance_tier"] == "low":
                await _adjust_scoring_weights(
                    session=session,
                    project_id=campaign.project_id,
                    delta={"engagement_w": +0.05, "sector_w": -0.05},
                )
                logger.info(
                    "[workflow] Weights adjusted (low performance) | campaign={}",
                    campaign_id,
                )

        await _update_job_status(job_id, "completed", analysis)
    except Exception as exc:
        logger.error("[workflow] Feedback loop error | job={} | {}", job_id, str(exc))
        await _update_job_status(job_id, "failed", str(exc))
    return job_id


def _build_recommendations(
    open_rate: float, click_rate: float, conversion_rate: float
) -> list[str]:
    """Build improvement recommendations from KPI thresholds."""
    recs: list[str] = []
    if open_rate < 0.25:
        recs.append("Improve subject lines — open rate below 25%.")
    if click_rate < 0.05:
        recs.append("Strengthen CTA — click rate below 5%.")
    if conversion_rate < 0.02:
        recs.append("Optimise landing page — conversion rate below 2%.")
    if not recs:
        recs.append("Campaign performing well — continue current strategy.")
    return recs


# ─── Celery Entry Point ───────────────────────────────────────────────────────


@celery_app.task(
    bind=True, name="workflow.run_l2c_pipeline", max_retries=3, default_retry_delay=30
)
def run_l2c_pipeline(self: Any, campaign_id: str) -> dict[str, Any]:
    """
    Celery entry-point: full Lead-to-Campaign pipeline.

    Fetches the campaign and its opted-in leads from the database,
    builds enriched lead dicts (sector, company_size, engagement counters)
    for accurate scoring, then dispatches the lead scoring pipeline.

    Args:
        campaign_id: String UUID of the target campaign.

    Returns:
        Dict with lead_job_id, campaign_id, and leads_count.
    """
    import asyncio

    async def _run() -> dict[str, Any]:
        from database.models_orm import Campaign, Lead
        from sqlalchemy import select

        async with db_session() as session:
            camp_result = await session.execute(
                select(Campaign).where(Campaign.id == campaign_id)
            )
            campaign = camp_result.scalar_one_or_none()
            if not campaign:
                raise ValueError(f"Campaign {campaign_id} not found")

            leads_result = await session.execute(
                select(Lead)
                .where(Lead.project_id == campaign.project_id)
                .where(Lead.opt_in.is_(True))
            )
            leads = [
                {
                    "id": str(lead.id),
                    "sector": lead.sector or "other",
                    "company_size": lead.company_size or "other",
                    "email_opens": lead.email_opens,
                    "email_clicks": lead.email_clicks,
                    "page_visits": lead.page_visits,
                    "source": lead.source or "other",
                    "opt_in": lead.opt_in,
                }
                for lead in leads_result.scalars().all()
            ]

        lead_job_id = await run_lead_pipeline(leads, campaign_id)
        logger.info(
            "[workflow] L2C pipeline | campaign={} leads={} job={}",
            campaign_id,
            len(leads),
            lead_job_id,
        )
        return {
            "lead_job_id": lead_job_id,
            "campaign_id": campaign_id,
            "leads_count": len(leads),
        }

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(
            "[workflow] run_l2c_pipeline failed | campaign={} error={}",
            campaign_id,
            str(exc),
        )
        raise self.retry(exc=exc)


# ─── RGPD Periodic Task ───────────────────────────────────────────────────────


@celery_app.task(name="brandscale.purge_expired_leads")
def purge_expired_leads() -> dict[str, int]:
    """
    RGPD art. 5 data-minimisation: delete leads older than data_retention_days.

    Runs daily at 02:00 UTC via Celery beat schedule.

    Returns:
        Dict with count of deleted leads.
    """
    import asyncio

    async def _run() -> dict[str, int]:
        cutoff = datetime.now(UTC) - timedelta(days=settings.data_retention_days)
        async with db_session() as session:
            result = await session.execute(delete(Lead).where(Lead.created_at < cutoff))
            await session.commit()
        logger.info(
            "[workflow] RGPD purge completed | deleted={} cutoff={}",
            result.rowcount,
            cutoff,
        )
        await send_alert(
            f"RGPD purge: {result.rowcount} leads deleted (cutoff: {cutoff.date()})",
            level="info",
        )
        return {"deleted": result.rowcount}

    return asyncio.run(_run())
