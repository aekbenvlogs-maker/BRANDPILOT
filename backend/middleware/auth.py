# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/middleware/auth.py
# DESCRIPTION  : JWT authentication middleware and dependency helpers
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from backend.api.v1.services.auth_service import decode_token
from configs.settings import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Bearer token extractor
# ---------------------------------------------------------------------------
_bearer_scheme = HTTPBearer(auto_error=False)

# Public routes — JWT not required
_PUBLIC_PATHS = {
    "/",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/health",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
}


def _is_public_path(path: str) -> bool:
    """Return True if the route does not require authentication."""
    return path in _PUBLIC_PATHS or path.startswith("/api/docs")


# ---------------------------------------------------------------------------
# FastAPI dependency — extract and validate JWT
# ---------------------------------------------------------------------------
async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> uuid.UUID:
    """
    FastAPI dependency that validates the Bearer JWT and returns the user UUID.

    Raises:
        HTTPException 401 if token is missing, invalid or expired.

    Returns:
        Authenticated user UUID.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise JWTError("Not an access token")
        user_id_str: str = payload["sub"]
        return uuid.UUID(user_id_str)
    except (JWTError, KeyError, ValueError) as exc:
        logger.warning("[BRANDSCALE] JWT validation failed | error={}", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_role(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """
    FastAPI dependency that extracts the user role from JWT.

    Returns:
        Role string (admin/manager/viewer).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    try:
        payload = decode_token(credentials.credentials)
        return str(payload.get("role", "viewer"))
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )


def require_role(required_role: str):  # type: ignore[no-untyped-def]
    """
    Factory for role-based access control dependency.

    Usage:
        @router.delete("/admin-only")
        async def admin_endpoint(role: str = Depends(require_role("admin"))):
            ...
    """
    async def _check_role(
        role: str = Depends(get_current_user_role),
    ) -> str:
        role_hierarchy = {"admin": 3, "manager": 2, "viewer": 1}
        if role_hierarchy.get(role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required, current role: '{role}'.",
            )
        return role

    return _check_role


# ---------------------------------------------------------------------------
# Starlette middleware — HTTPS enforcement in production
# ---------------------------------------------------------------------------
class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces HTTPS in production.

    Does not perform per-request JWT checks (that is handled per-endpoint
    via `get_current_user_id` dependency) but ensures TLS is required.
    """

    async def dispatch(self, request: Request, call_next: object) -> Response:
        """Enforce HTTPS in production environment."""
        if settings.is_production:
            # Check for forwarded proto (behind reverse proxy)
            proto = request.headers.get("x-forwarded-proto", "http")
            if proto != "https":
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=301,
                    content={"detail": "HTTPS required in production."},
                    headers={"Location": str(request.url).replace("http://", "https://")},
                )
        return await call_next(request)  # type: ignore[call-arg]
