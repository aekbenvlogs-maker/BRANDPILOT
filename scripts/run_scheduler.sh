#!/usr/bin/env bash
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/run_scheduler.sh
# DESCRIPTION  : Start Celery Beat scheduler for periodic tasks
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

LOG_LEVEL="${CELERY_LOG_LEVEL:-info}"
SCHEDULE_DB="${CELERY_BEAT_SCHEDULE:-/tmp/brandscale_celerybeat-schedule}"

echo "[BRANDSCALE] Starting Celery Beat scheduler"
exec celery -A microservices.bs_ai_text.worker.celery_app beat \
  --loglevel="$LOG_LEVEL" \
  --schedule="$SCHEDULE_DB"
