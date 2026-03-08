# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : database/models_orm.py
# DESCRIPTION  : SQLAlchemy 2.0 ORM models for all BRANDSCALE entities
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base


# ---------------------------------------------------------------------------
# Enumerations (mirrors schema.sql ENUMs)
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    """Roles available for BRANDSCALE users."""

    admin = "admin"
    manager = "manager"
    viewer = "viewer"


class CampaignStatus(str, enum.Enum):
    """Lifecycle stages of a campaign."""

    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class CampaignChannel(str, enum.Enum):
    """Distribution channel for a campaign."""

    email = "email"
    social = "social"
    ads = "ads"
    sms = "sms"
    multi = "multi"


class ContentType(str, enum.Enum):
    """Type of AI-generated content."""

    post = "post"
    email = "email"
    ad = "ad"
    newsletter = "newsletter"
    video_script = "video_script"


class ScoreTier(str, enum.Enum):
    """Lead quality tier derived from numeric score."""

    hot = "hot"
    warm = "warm"
    cold = "cold"


class WorkflowStepStatus(str, enum.Enum):
    """State of a workflow job step."""

    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    retrying = "retrying"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(Base):
    """BRANDSCALE platform user with role-based access control."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.manager
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    # RGPD
    consent_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    consent_source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Relationships
    projects: Mapped[list[Project]] = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------
class Project(Base):
    """A marketing project grouping campaigns and leads."""

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner: Mapped[User] = relationship("User", back_populates="projects")
    campaigns: Mapped[list[Campaign]] = relationship(
        "Campaign", back_populates="project", cascade="all, delete-orphan"
    )
    leads: Mapped[list[Lead]] = relationship(
        "Lead", back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_projects_user_id", "user_id"),
        Index("idx_projects_archived", "archived"),
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name}>"


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------
class Campaign(Base):
    """An individual marketing campaign within a project."""

    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus), nullable=False, default=CampaignStatus.draft
    )
    channel: Mapped[CampaignChannel] = mapped_column(
        Enum(CampaignChannel), nullable=False, default=CampaignChannel.email
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )
    launched_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="campaigns")
    contents: Mapped[list[Content]] = relationship(
        "Content", back_populates="campaign", cascade="all, delete-orphan"
    )
    emails: Mapped[list[Email]] = relationship(
        "Email", back_populates="campaign", cascade="all, delete-orphan"
    )
    analytics: Mapped[list[Analytics]] = relationship(
        "Analytics", back_populates="campaign", cascade="all, delete-orphan"
    )
    workflow_jobs: Mapped[list[WorkflowJob]] = relationship(
        "WorkflowJob", back_populates="campaign"
    )

    __table_args__ = (
        Index("idx_campaigns_project_id", "project_id"),
        Index("idx_campaigns_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Campaign id={self.id} name={self.name} status={self.status}>"


# ---------------------------------------------------------------------------
# Lead
# ---------------------------------------------------------------------------
class Lead(Base):
    """A marketing lead with scoring and RGPD consent tracking."""

    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    # PII — stored encrypted via Fernet in service layer
    email: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    # Scoring
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    score_tier: Mapped[ScoreTier] = mapped_column(
        Enum(ScoreTier), nullable=False, default=ScoreTier.cold
    )
    score_updated_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    # RGPD
    opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    consent_source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    # Metadata
    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="leads")
    contents: Mapped[list[Content]] = relationship("Content", back_populates="lead")
    emails: Mapped[list[Email]] = relationship(
        "Email", back_populates="lead", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_leads_project_id", "project_id"),
        Index("idx_leads_score_tier", "score_tier"),
        Index("idx_leads_opt_in", "opt_in"),
    )

    def __repr__(self) -> str:
        return f"<Lead id={self.id} score={self.score} tier={self.score_tier}>"


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------
class Content(Base):
    """AI-generated content piece linked to a campaign and optionally a lead."""

    __tablename__ = "content"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType), nullable=False
    )
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    campaign: Mapped[Campaign] = relationship("Campaign", back_populates="contents")
    lead: Mapped[Optional[Lead]] = relationship("Lead", back_populates="contents")

    def __repr__(self) -> str:
        return f"<Content id={self.id} type={self.content_type}>"


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
class Email(Base):
    """Sent email record with tracking fields and RGPD unsubscribe flag."""

    __tablename__ = "emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(998), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    clicked_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    bounced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unsubscribed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    campaign: Mapped[Campaign] = relationship("Campaign", back_populates="emails")
    lead: Mapped[Lead] = relationship("Lead", back_populates="emails")

    def __repr__(self) -> str:
        return f"<Email id={self.id} lead_id={self.lead_id} sent={self.sent_at}>"


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class Analytics(Base):
    """Daily campaign performance metrics."""

    __tablename__ = "analytics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    emails_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    open_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    ctr: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    conversions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_cost_usd: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    campaign: Mapped[Campaign] = relationship("Campaign", back_populates="analytics")

    __table_args__ = (
        UniqueConstraint("campaign_id", "date", name="uq_analytics_campaign_date"),
        Index("idx_analytics_campaign_id", "campaign_id"),
        Index("idx_analytics_date", "date"),
    )

    def __repr__(self) -> str:
        return f"<Analytics campaign={self.campaign_id} date={self.date}>"


# ---------------------------------------------------------------------------
# WorkflowJob
# ---------------------------------------------------------------------------
class WorkflowJob(Base):
    """Tracks the state of a Lead-to-Content workflow execution."""

    __tablename__ = "workflow_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
    )
    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    current_step: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[WorkflowStepStatus] = mapped_column(
        Enum(WorkflowStepStatus),
        nullable=False,
        default=WorkflowStepStatus.pending,
    )
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # type: ignore[type-arg]
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # type: ignore[type-arg]
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    campaign: Mapped[Optional[Campaign]] = relationship(
        "Campaign", back_populates="workflow_jobs"
    )

    def __repr__(self) -> str:
        return f"<WorkflowJob id={self.id} type={self.job_type} status={self.status}>"


# ---------------------------------------------------------------------------
# RefreshToken
# ---------------------------------------------------------------------------
class RefreshToken(Base):
    """JWT refresh token store for secure token rotation."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")

    def __repr__(self) -> str:
        return f"<RefreshToken user={self.user_id} revoked={self.revoked}>"


if __name__ == "__main__":
    # Print table names for verification
    for table_name in Base.metadata.tables:
        print(f"[BRANDSCALE] ORM table registered: {table_name}")
