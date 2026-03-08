# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/services/auth_service.py
# DESCRIPTION  : JWT authentication, password hashing, token management
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from loguru import logger
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from configs.settings import get_settings
from database.models_orm import RefreshToken, User

settings = get_settings()

# ---------------------------------------------------------------------------
# Password hashing context
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT token generation
# ---------------------------------------------------------------------------
def create_access_token(user_id: uuid.UUID, role: str) -> str:
    """
    Create a signed JWT access token.

    Args:
        user_id: UUID of the authenticated user.
        role:    User role string for RBAC.

    Returns:
        Signed JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> str:
    """
    Create a signed JWT refresh token.

    Args:
        user_id: UUID of the authenticated user.

    Returns:
        Signed JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # unique token ID for revocation
        "type": "refresh",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:  # type: ignore[type-arg]
    """
    Decode and validate a JWT token.

    Args:
        token: JWT string to decode.

    Returns:
        Decoded payload dict.

    Raises:
        JWTError: If token is invalid or expired.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def _hash_token(token: str) -> str:
    """Hash a refresh token for safe storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------
async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> Optional[User]:
    """
    Authenticate user by email + password.

    Args:
        db:       Async database session.
        email:    User email.
        password: Plain-text password.

    Returns:
        User ORM object if credentials are valid, None otherwise.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        logger.warning("[BRANDSCALE] Failed login attempt for email={}", email)
        return None

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("[BRANDSCALE] User authenticated | id={} role={}", user.id, user.role)
    return user


async def store_refresh_token(
    db: AsyncSession, user_id: uuid.UUID, token: str
) -> None:
    """
    Persist a refresh token hash to the database.

    Args:
        db:      Async database session.
        user_id: Owner user UUID.
        token:   Raw refresh token string (stored as hash).
    """
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    record = RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(token),
        expires_at=expires_at,
    )
    db.add(record)
    await db.flush()


async def validate_refresh_token(
    db: AsyncSession, token: str
) -> Optional[User]:
    """
    Validate a refresh token and return the associated user.

    Args:
        db:    Async database session.
        token: Raw refresh token string.

    Returns:
        User if token is valid and not revoked, None otherwise.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            return None
        user_id_str: str = payload["sub"]
    except JWTError:
        logger.warning("[BRANDSCALE] Invalid refresh token submitted.")
        return None

    token_hash = _hash_token(token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()

    if stored is None:
        logger.warning("[BRANDSCALE] Refresh token not found or expired.")
        return None

    user_result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id_str))
    )
    return user_result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: str) -> None:
    """
    Mark a refresh token as revoked (logout).

    Args:
        db:    Async database session.
        token: Raw refresh token string.
    """
    token_hash = _hash_token(token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True
        await db.flush()
        logger.info("[BRANDSCALE] Refresh token revoked.")


if __name__ == "__main__":
    print("[BRANDSCALE] auth_service.py — smoke test")
    pw = hash_password("TestPassword1")
    assert verify_password("TestPassword1", pw)
    print("[BRANDSCALE] Password hash/verify OK")
