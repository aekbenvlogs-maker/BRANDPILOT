# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : tests/conftest.py
# DESCRIPTION  : Root pytest conftest — injects test env vars
#                before any Settings instance is created.
# ============================================================

import os

# ---------------------------------------------------------------------------
# Inject minimal required env vars BEFORE any module-level Settings() call.
# These dummy values satisfy pydantic-settings validation; real network /
# DB calls are mocked in each test via pytest-mock.
# ---------------------------------------------------------------------------

os.environ.setdefault("SECRET_KEY", "test-secret-key-brandscale-32chars!!")
os.environ.setdefault(
    "DATABASE_URL", "sqlite+aiosqlite:///./brandscale_test.db"
)
os.environ.setdefault("OPENAI_API_KEY", "sk-test-00000000000000000000000000000000")
# Valid Fernet key (32 url-safe base64 bytes) — test-only, never production
os.environ.setdefault(
    "FERNET_KEY", "6FG8sMPC77gERnsyQvRaueaEd1NkjLmJqtX7f7dV5JQ="
)
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

# ---------------------------------------------------------------------------
# Initialise the database engine once (SQLite in-memory) so that FastAPI
# lifespan / db_session calls in backend tests don't crash.
# ---------------------------------------------------------------------------
from database.connection import init_db  # noqa: E402

init_db(database_url="sqlite+aiosqlite:///./brandscale_test.db", echo=False)
