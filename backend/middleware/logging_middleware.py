# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/middleware/logging_middleware.py
# DESCRIPTION  : Starlette request/response logging middleware
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import time
import uuid

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs every incoming request and outgoing response.

    Log format includes:
    - Unique request ID
    - HTTP method + path
    - Response status code
    - Duration in milliseconds
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """
        Log request start, call next middleware/handler, log response.

        Args:
            request:   Incoming Starlette request.
            call_next: Next middleware or route handler.

        Returns:
            Response from downstream handler.
        """
        request_id = str(uuid.uuid4())[:8]  # short ID for log readability
        start = time.perf_counter()

        # Attach request_id to request state for traceability
        request.state.request_id = request_id

        logger.info(
            "[BRANDSCALE] → REQUEST | id={} method={} path={} client={}",
            request_id,
            request.method,
            request.url.path,
            request.client.host if request.client else "unknown",
        )

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "[BRANDSCALE] ✗ ERROR | id={} path={} elapsed={:.1f}ms error={}",
                request_id,
                request.url.path,
                elapsed_ms,
                str(exc),
            )
            raise

        elapsed_ms = (time.perf_counter() - start) * 1000
        log_fn = logger.warning if response.status_code >= 400 else logger.info

        log_fn(
            "[BRANDSCALE] ← RESPONSE | id={} method={} path={} status={} elapsed={:.1f}ms",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

        # Add request ID to response headers for client-side tracing
        response.headers["X-Request-ID"] = request_id
        return response
