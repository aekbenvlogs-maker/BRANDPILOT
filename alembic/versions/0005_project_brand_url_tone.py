# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : alembic/versions/0005_project_brand_url_tone.py
# DESCRIPTION  : Add brand_url and tone columns to projects table
# AUTHOR       : BRANDSCALE Dev Team
# LAST UPDATED : 2026-03-11
# ============================================================
"""Add brand_url and tone to projects table

Allows storing the brand website URL and detected tone per project,
enabling automatic bs_brand_analyzer runs at project creation time
(O-03 from the audit plan).

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-11 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # brand_url — nullable VARCHAR for the brand website (up to 2048 chars)
    op.add_column(
        "projects",
        sa.Column(
            "brand_url",
            sa.String(2048),
            nullable=True,
            comment="Brand website URL for automated bs_brand_analyzer analysis",
        ),
    )
    # tone — nullable VARCHAR for the detected brand tone
    op.add_column(
        "projects",
        sa.Column(
            "tone",
            sa.String(64),
            nullable=True,
            comment="Detected brand tone from bs_brand_analyzer (e.g. professional, playful)",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "tone")
    op.drop_column("projects", "brand_url")
