# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : database/connection.py
# DESCRIPTION  : Async SQLAlchemy engine + session factory
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool


# ---------------------------------------------------------------------------
# ORM Base class — imported by all models
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Declarative base for all BRANDSCALE ORM models."""


# ---------------------------------------------------------------------------
# Module-level engine and session factory (lazy init)
# ---------------------------------------------------------------------------
_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Return the module-level async engine (must be initialised first)."""
    if _engine is None:
        raise RuntimeError(
            "[BRANDSCALE] Database engine not initialised. "
            "Call `init_db(database_url)` before accessing the engine."
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory."""
    if _async_session_factory is None:
        raise RuntimeError(
            "[BRANDSCALE] Session factory not initialised. "
            "Call `init_db(database_url)` first."
        )
    return _async_session_factory


def init_db(
    database_url: str,
    echo: bool = False,
    pool_size: int = 10,
    max_overflow: int = 20,
    use_null_pool: bool = False,
) -> None:
    """
    Initialise the async SQLAlchemy engine and session factory.

    Args:
        database_url: Full async database URL (asyncpg or aiosqlite).
        echo:          Enable SQLAlchemy query logging.
        pool_size:     Connection pool size (ignored with NullPool).
        max_overflow:  Max connections above pool_size.
        use_null_pool: Use NullPool (useful for testing / serverless).
    """
    global _engine, _async_session_factory  # noqa: PLW0603

    engine_kwargs: dict[str, Any] = {"echo": echo}

    if use_null_pool:
        # NullPool: creates a new connection for each request (good for pytest)
        engine_kwargs["poolclass"] = NullPool
    elif "sqlite" not in database_url:
        # SQLite does not support pool_size / max_overflow
        engine_kwargs["pool_size"] = pool_size
        engine_kwargs["max_overflow"] = max_overflow
        engine_kwargs["pool_pre_ping"] = True

    _engine = create_async_engine(database_url, **engine_kwargs)

    _async_session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )

    logger.info("[BRANDSCALE] Database engine initialised → {}", database_url.split("@")[-1])


async def close_db() -> None:
    """Dispose the engine connection pool gracefully on shutdown."""
    if _engine is not None:
        await _engine.dispose()
        logger.info("[BRANDSCALE] Database engine disposed.")


async def create_all_tables() -> None:
    """
    Create all ORM-defined tables in the database.
    For production use Alembic migrations instead.
    """
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("[BRANDSCALE] All database tables created.")


async def drop_all_tables() -> None:
    """Drop all tables — DANGEROUS, use only in test environments."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    logger.warning("[BRANDSCALE] All database tables dropped!")


# ---------------------------------------------------------------------------
# FastAPI dependency — yields an async session per request
# ---------------------------------------------------------------------------
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a per-request async DB session.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db_session)):
            ...
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Context manager variant for non-FastAPI code (scripts, workers)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for getting a DB session outside FastAPI.

    Usage:
        async with db_session() as session:
            result = await session.execute(select(User))
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


if __name__ == "__main__":
    import asyncio

    async def _smoke_test() -> None:
        """Quick connectivity smoke test."""
        init_db("sqlite+aiosqlite:///./test_smoke.db", echo=True)
        await create_all_tables()
        logger.info("[BRANDSCALE] Smoke test passed — database layer OK.")
        await close_db()

    asyncio.run(_smoke_test())
