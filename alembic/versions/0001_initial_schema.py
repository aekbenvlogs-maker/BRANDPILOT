# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : alembic/versions/0001_initial_schema.py
# DESCRIPTION  : Baseline migration — creates all tables and ENUMs
# ============================================================
"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-08 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # PostgreSQL ENUMs
    # ------------------------------------------------------------------
    op.execute(
        "CREATE TYPE IF NOT EXISTS userrole AS ENUM ('admin', 'manager', 'viewer')"
    )
    op.execute(
        "CREATE TYPE IF NOT EXISTS campaignstatus AS ENUM ('draft', 'active', 'paused', 'completed')"
    )
    op.execute(
        "CREATE TYPE IF NOT EXISTS campaignchannel AS ENUM ('email', 'social', 'ads', 'sms', 'multi')"
    )
    op.execute(
        "CREATE TYPE IF NOT EXISTS contenttype AS ENUM ('post', 'email', 'ad', 'newsletter', 'video_script')"
    )
    op.execute(
        "CREATE TYPE IF NOT EXISTS scoretier AS ENUM ('hot', 'warm', 'cold')"
    )
    op.execute(
        "CREATE TYPE IF NOT EXISTS workflowstepstatus AS ENUM "
        "('pending', 'running', 'completed', 'failed', 'retrying')"
    )

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "manager", "viewer", name="userrole", create_type=False),
            nullable=False,
            server_default="manager",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("consent_date", sa.DateTime(), nullable=True),
        sa.Column("consent_source", sa.String(128), nullable=True),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=True)

    # ------------------------------------------------------------------
    # projects
    # ------------------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_projects_user_id", "projects", ["user_id"])
    op.create_index("idx_projects_archived", "projects", ["archived"])

    # ------------------------------------------------------------------
    # campaigns
    # ------------------------------------------------------------------
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "active", "paused", "completed", name="campaignstatus", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "channel",
            sa.Enum("email", "social", "ads", "sms", "multi", name="campaignchannel", create_type=False),
            nullable=False,
            server_default="email",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("launched_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_campaigns_project_id", "campaigns", ["project_id"])
    op.create_index("idx_campaigns_status", "campaigns", ["status"])

    # ------------------------------------------------------------------
    # leads  (includes new engagement counters + company_size)
    # ------------------------------------------------------------------
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # PII — stored Fernet-encrypted
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=True),
        sa.Column("last_name", sa.Text(), nullable=True),
        sa.Column("company", sa.String(256), nullable=True),
        sa.Column("sector", sa.String(128), nullable=True),
        sa.Column("company_size", sa.String(64), nullable=True),
        # Engagement counters
        sa.Column("email_opens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("email_clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("page_visits", sa.Integer(), nullable=False, server_default="0"),
        # Scoring
        sa.Column("score", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "score_tier",
            sa.Enum("hot", "warm", "cold", name="scoretier", create_type=False),
            nullable=False,
            server_default="cold",
        ),
        sa.Column("score_updated_at", sa.DateTime(), nullable=True),
        # RGPD
        sa.Column("opt_in", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("consent_date", sa.DateTime(), nullable=True),
        sa.Column("consent_source", sa.String(128), nullable=True),
        # Metadata
        sa.Column("source", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_leads_project_id", "leads", ["project_id"])
    op.create_index("idx_leads_score_tier", "leads", ["score_tier"])
    op.create_index("idx_leads_opt_in", "leads", ["opt_in"])

    # ------------------------------------------------------------------
    # content
    # ------------------------------------------------------------------
    op.create_table(
        "content",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "content_type",
            sa.Enum("post", "email", "ad", "newsletter", "video_script", name="contenttype", create_type=False),
            nullable=False,
        ),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("prompt_used", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    # ------------------------------------------------------------------
    # emails
    # ------------------------------------------------------------------
    op.create_table(
        "emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(998), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("opened_at", sa.DateTime(), nullable=True),
        sa.Column("clicked_at", sa.DateTime(), nullable=True),
        sa.Column("bounced", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unsubscribed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_emails_campaign_id", "emails", ["campaign_id"])
    op.create_index("idx_emails_lead_id", "emails", ["lead_id"])

    # ------------------------------------------------------------------
    # analytics
    # ------------------------------------------------------------------
    op.create_table(
        "analytics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("emails_sent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("ctr", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ai_cost_usd", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("campaign_id", "date", name="uq_analytics_campaign_date"),
    )
    op.create_index("idx_analytics_campaign_id", "analytics", ["campaign_id"])
    op.create_index("idx_analytics_date", "analytics", ["date"])

    # ------------------------------------------------------------------
    # workflow_jobs
    # ------------------------------------------------------------------
    op.create_table(
        "workflow_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("job_type", sa.String(64), nullable=False),
        sa.Column("current_step", sa.String(128), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "running", "completed", "failed", "retrying",
                name="workflowstepstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    # ------------------------------------------------------------------
    # refresh_tokens
    # ------------------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(256), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("workflow_jobs")
    op.drop_table("analytics")
    op.drop_table("emails")
    op.drop_table("content")
    op.drop_table("leads")
    op.drop_table("campaigns")
    op.drop_table("projects")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS workflowstepstatus")
    op.execute("DROP TYPE IF EXISTS scoretier")
    op.execute("DROP TYPE IF EXISTS contenttype")
    op.execute("DROP TYPE IF EXISTS campaignchannel")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
