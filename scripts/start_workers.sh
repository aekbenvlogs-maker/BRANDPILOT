#!/usr/bin/env bash
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/start_workers.sh
# DESCRIPTION  : Start all Celery workers for every microservice
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

CONCURRENCY="${CELERY_CONCURRENCY:-4}"
LOG_LEVEL="${CELERY_LOG_LEVEL:-info}"

declare -A WORKERS=(
  ["bs_ai_text"]="microservices.bs_ai_text.worker.celery_app"
  ["bs_ai_image"]="microservices.bs_ai_image.worker.celery_app"
  ["bs_ai_video"]="microservices.bs_ai_video.worker.celery_app"
  ["bs_email"]="microservices.bs_email.worker.celery_app"
  ["bs_scoring"]="microservices.bs_scoring.worker.celery_app"
)

PIDS=()

cleanup() {
  echo "[BRANDSCALE] Stopping all workers…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

for name in "${!WORKERS[@]}"; do
  app="${WORKERS[$name]}"
  echo "[BRANDSCALE] Starting worker: ${name} (app=${app})"
  celery -A "$app" worker \
    --loglevel="$LOG_LEVEL" \
    --concurrency="$CONCURRENCY" \
    --hostname="${name}@%h" &
  PIDS+=($!)
done

echo "[BRANDSCALE] All workers started. PIDs: ${PIDS[*]}"
wait
