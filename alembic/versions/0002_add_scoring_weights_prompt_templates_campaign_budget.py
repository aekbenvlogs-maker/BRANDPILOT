# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : alembic/versions/0002_add_scoring_weights_prompt_templates_campaign_budget.py
# DESCRIPTION  : Phase 3+4 migrations — scoring_weights, prompt_templates, campaign AI budget
# ============================================================
"""add scoring_weights, prompt_templates, campaign ai_budget fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-08 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # campaigns — add AI budget tracking columns
    # ------------------------------------------------------------------
    op.add_column(
        "campaigns",
        sa.Column(
            "ai_budget_usd",
            sa.Numeric(10, 2),
            nullable=True,
            comment="AI budget cap in USD for this campaign",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "ai_spent_usd",
            sa.Numeric(10, 4),
            nullable=False,
            server_default="0.0000",
            comment="AI cost consumed so far in USD",
        ),
    )

    # ------------------------------------------------------------------
    # scoring_weights — per-project, feedback-loop-adjustable weights
    # ------------------------------------------------------------------
    op.create_table(
        "scoring_weights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sector_w", sa.Float, nullable=False, server_default="0.25"),
        sa.Column("company_size_w", sa.Float, nullable=False, server_default="0.20"),
        sa.Column("engagement_w", sa.Float, nullable=False, server_default="0.35"),
        sa.Column("source_w", sa.Float, nullable=False, server_default="0.20"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("updated_by", sa.String(32), nullable=False, server_default="system"),
    )
    op.create_index("idx_scoring_weights_project_id", "scoring_weights", ["project_id"])

    # ------------------------------------------------------------------
    # prompt_templates — versioned, switchable AI prompt library
    # ------------------------------------------------------------------
    op.create_table(
        "prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("content_type", sa.String(32), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("system_prompt", sa.Text, nullable=False),
        sa.Column("user_prompt_template", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "idx_prompt_templates_type_active",
        "prompt_templates",
        ["content_type", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("idx_prompt_templates_type_active", table_name="prompt_templates")
    op.drop_table("prompt_templates")

    op.drop_index("idx_scoring_weights_project_id", table_name="scoring_weights")
    op.drop_table("scoring_weights")

    op.drop_column("campaigns", "ai_spent_usd")
    op.drop_column("campaigns", "ai_budget_usd")
