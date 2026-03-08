# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : alembic/env.py
# DESCRIPTION  : Async-compatible Alembic migration environment
# ============================================================
from __future__ import annotations

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Ensure project root is on sys.path so our modules resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from configs.settings import get_settings  # noqa: E402
from database.models_orm import Base  # noqa: E402

settings = get_settings()

# ---------------------------------------------------------------------------
# Alembic Config — inject DB URL from settings
# ---------------------------------------------------------------------------
config = context.config
config.set_main_option("sqlalchemy.url", settings.active_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline migrations (generate SQL script without a live DB connection)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migrations (async — requires a running PostgreSQL)
# ---------------------------------------------------------------------------
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
