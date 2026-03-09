# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/auth.py
# DESCRIPTION  : FastAPI auth routes — login, token refresh, logout
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from database.connection import get_db_session
from database.models_orm import User
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.user import (
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserLoginRequest,
    UserResponse,
)
from backend.api.v1.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    hash_password,
    revoke_refresh_token,
    store_refresh_token,
    validate_refresh_token,
)
from configs.settings import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    credentials: UserLoginRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """
    Authenticate user and return JWT access + refresh tokens.

    - **email**: registered user email
    - **password**: account password
    """
    user = await authenticate_user(db, credentials.email, credentials.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)
    await store_refresh_token(db, user.id, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """
    Refresh an expired access token using a valid refresh token.

    Issues new access + refresh token pair (token rotation).
    """
    user = await validate_refresh_token(db, body.refresh_token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    # Revoke old token (rotation)
    await revoke_refresh_token(db, body.refresh_token)

    access_token = create_access_token(user.id, user.role.value)
    new_refresh = create_refresh_token(user.id)
    await store_refresh_token(db, user.id, new_refresh)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Revoke the user's refresh token (logout).

    Client should also discard the access token locally.
    """
    await revoke_refresh_token(db, body.refresh_token)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    """
    Register a new BRANDSCALE user.

    In production, restrict this endpoint to admin role.
    """
    from sqlalchemy import select

    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        consent_date=data.consent_date,
        consent_source=data.consent_source,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)
