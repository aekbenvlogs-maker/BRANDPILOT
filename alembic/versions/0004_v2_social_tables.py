# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : alembic/versions/0004_v2_social_tables.py
# DESCRIPTION  : V2 social tables — social_accounts, brand_analyses,
#                influencer_analyses
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
"""V2 Social tables: social_accounts, brand_analyses, influencer_analyses

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-10 14:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PLATFORM_CHECK = "platform IN ('instagram','tiktok','youtube','x','linkedin')"


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. social_accounts
    # ------------------------------------------------------------------
    op.create_table(
        "social_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column(
            "platform",
            sa.String(20),
            nullable=False,
            comment="instagram|tiktok|youtube|x|linkedin",
        ),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("followers_count", sa.Integer(), nullable=True),
        sa.Column("engagement_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("last_synced_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(_PLATFORM_CHECK, name="ck_social_accounts_platform"),
        sa.UniqueConstraint(
            "project_id",
            "platform",
            name="uq_social_accounts_project_platform",
        ),
    )
    op.create_index(
        "ix_social_accounts_project_platform",
        "social_accounts",
        ["project_id", "platform"],
    )

    # ------------------------------------------------------------------
    # 2. brand_analyses
    # ------------------------------------------------------------------
    op.create_table(
        "brand_analyses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("detected_tone", sa.String(50), nullable=True),
        sa.Column("detected_niche", sa.String(50), nullable=True),
        sa.Column(
            "primary_colors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "keywords",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("target_audience", sa.Text(), nullable=True),
        sa.Column("consistency_score", sa.Integer(), nullable=True),
        sa.Column(
            "competitors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("raw_report", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_brand_analyses_project_id", "brand_analyses", ["project_id"])

    # ------------------------------------------------------------------
    # 3. influencer_analyses
    # ------------------------------------------------------------------
    op.create_table(
        "influencer_analyses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("followers_count", sa.Integer(), nullable=True),
        sa.Column("engagement_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("niche", sa.String(50), nullable=True),
        sa.Column("estimated_price_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("estimated_price_max", sa.Numeric(10, 2), nullable=True),
        sa.Column("audience_authenticity_score", sa.Integer(), nullable=True),
        sa.Column(
            "best_posting_times",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(_PLATFORM_CHECK, name="ck_influencer_analyses_platform"),
    )
    op.create_index(
        "ix_influencer_analyses_project_platform_username",
        "influencer_analyses",
        ["project_id", "platform", "username"],
    )


def downgrade() -> None:
    op.drop_index("ix_influencer_analyses_project_platform_username", "influencer_analyses")
    op.drop_table("influencer_analyses")

    op.drop_index("ix_brand_analyses_project_id", "brand_analyses")
    op.drop_table("brand_analyses")

    op.drop_index("ix_social_accounts_project_platform", "social_accounts")
    op.drop_table("social_accounts")
