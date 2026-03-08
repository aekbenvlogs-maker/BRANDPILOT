#!/usr/bin/env bash
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/start_backend.sh
# DESCRIPTION  : Start FastAPI backend with uvicorn
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "[BRANDSCALE] .env not found — copying from .env.example"
  cp .env.example .env
fi

# Activate virtual environment if present
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-1}"
APP_ENV="${APP_ENV:-development}"

echo "[BRANDSCALE] Starting FastAPI backend on ${HOST}:${PORT} (env=${APP_ENV})"

if [ "$APP_ENV" = "production" ]; then
  exec uvicorn backend.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS" \
    --log-level info
else
  exec uvicorn backend.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    --log-level debug
fi
