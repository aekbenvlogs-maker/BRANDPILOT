# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/middleware/error_handler.py
# DESCRIPTION  : Global exception handlers for FastAPI
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import ValidationError


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register global exception handlers on the FastAPI application.

    Handles:
    - RequestValidationError (Pydantic v2 validation failures)
    - ValidationError (direct Pydantic model errors)
    - Generic unhandled exceptions
    """

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Return structured validation error response."""
        errors = []
        for error in exc.errors():
            errors.append(
                {
                    "field": " → ".join(str(loc) for loc in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"],
                }
            )
        logger.warning(
            "[BRANDSCALE] Validation error | path={} errors={}",
            request.url.path,
            errors,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation failed",
                "details": errors,
                "path": str(request.url.path),
            },
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic model validation errors."""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Schema validation error", "details": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all handler — returns 500 without leaking internals."""
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception(
            "[BRANDSCALE] Unhandled exception | id={} path={} error={}",
            request_id,
            request.url.path,
            str(exc),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "request_id": request_id,
                "message": "An unexpected error occurred. Please try again.",
            },
        )
