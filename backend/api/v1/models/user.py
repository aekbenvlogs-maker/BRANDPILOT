# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/models/user.py
# DESCRIPTION  : Pydantic v2 request/response models for User entity
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from database.models_orm import UserRole


class UserBase(BaseModel):
    """Shared fields for User create/update."""

    email: EmailStr = Field(description="User email address")
    role: UserRole = Field(default=UserRole.manager, description="User access role")


class UserCreate(UserBase):
    """Request body for creating a new user."""

    password: str = Field(min_length=8, max_length=128, description="Raw password")
    consent_date: Optional[datetime] = Field(default=None)
    consent_source: Optional[str] = Field(default=None, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """Enforce basic password strength requirements."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class UserUpdate(BaseModel):
    """Request body for updating a user (all fields optional)."""

    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """API response model for a user."""

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserLoginRequest(BaseModel):
    """Request body for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response containing JWT access and refresh tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Seconds until access token expires")


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh."""

    refresh_token: str
