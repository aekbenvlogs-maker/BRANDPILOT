# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/main.py
# DESCRIPTION  : FastAPI application entry point with lifespan management
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from database.connection import close_db, create_all_tables, init_db
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

# Route imports
from backend.api.v1.routes import (
    analytics,
    auth,
    campaigns,
    campaigns_agent,
    content,
    health,
    leads,
    projects,
    workflows,
)
from backend.middleware.auth import JWTAuthMiddleware
from backend.middleware.error_handler import register_exception_handlers
from backend.middleware.logging_middleware import RequestLoggingMiddleware
from configs.logging_config import setup_logging
from configs.settings import get_settings

settings = get_settings()


# ---------------------------------------------------------------------------
# Application lifespan — startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan context manager.

    Startup:
    - Configure logging
    - Initialise database engine
    - Create tables (dev only — use Alembic in production)

    Shutdown:
    - Dispose database engine
    """
    # --- Startup ---
    setup_logging(
        log_level=settings.log_level,
        log_dir="logs",
        max_size_mb=settings.log_max_size_mb,
        retention_days=settings.log_retention_days,
    )

    from loguru import logger

    logger.info("[BRANDSCALE] Starting up — env={}", settings.app_env)

    init_db(
        database_url=settings.active_database_url,
        echo=settings.app_debug,
    )

    if settings.app_env == "development":
        await create_all_tables()
        logger.info("[BRANDSCALE] Dev tables ensured.")

    logger.info("[BRANDSCALE] Application ready — v{}", settings.app_version)

    yield  # Application runs here

    # --- Shutdown ---
    logger.info("[BRANDSCALE] Shutting down gracefully...")
    await close_db()
    logger.info("[BRANDSCALE] Database connection pool closed.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    """
    Application factory — creates and configures the FastAPI instance.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(
        title="BRANDSCALE API",
        description=(
            "BRANDSCALE — AI-powered marketing automation platform. "
            "Automate lead scoring, content generation, email campaigns and analytics."
        ),
        version=settings.app_version,
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Custom middleware ---
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(JWTAuthMiddleware)

    # --- Exception handlers ---
    register_exception_handlers(app)

    # --- Routers ---
    _register_routers(app)

    # --- Prometheus metrics ---
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    return app


def _register_routers(app: FastAPI) -> None:
    """Register all API v1 routers with the application."""
    prefix = "/api/v1"

    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Auth"])
    app.include_router(projects.router, prefix=f"{prefix}/projects", tags=["Projects"])
    app.include_router(
        campaigns.router, prefix=f"{prefix}/campaigns", tags=["Campaigns"]
    )
    app.include_router(
        campaigns_agent.router,
        prefix=f"{prefix}/campaigns/agent",
        tags=["Campaigns — Agent"],
    )
    app.include_router(leads.router, prefix=f"{prefix}/leads", tags=["Leads"])
    app.include_router(content.router, prefix=f"{prefix}/content", tags=["Content"])
    app.include_router(
        workflows.router, prefix=f"{prefix}/workflows", tags=["Workflows"]
    )
    app.include_router(
        analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"]
    )
    app.include_router(health.router, prefix=f"{prefix}/health", tags=["Health"])


# ---------------------------------------------------------------------------
# ASGI application instance
# ---------------------------------------------------------------------------
app = create_app()


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    """Root endpoint — returns application identity."""
    return JSONResponse(
        {
            "service": "BRANDSCALE API",
            "version": settings.app_version,
            "status": "running",
            "docs": "/api/docs",
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
        log_level=settings.log_level.lower(),
        access_log=True,
    )
