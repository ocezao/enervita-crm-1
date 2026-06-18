#!/usr/bin/env bash
set -euo pipefail

log(){ echo "[$(date '+%F %T')] $*"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/compose.prod.yaml}"
SERVICE_WEB="${SERVICE_WEB:-crm-web}"
SERVICE_API="${SERVICE_API:-crm-api}"
SMOKE_URL="${SMOKE_URL:-https://crm.enervita.com.br}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"

log "Running CI gate"
./scripts/ci-gate.sh

log "Resolving compose service names and backups"
WEB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE_WEB" || true)
API_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE_API" || true)
PREV_WEB_IMAGE=""
PREV_API_IMAGE=""
if [[ -n "$WEB_CONTAINER" ]]; then PREV_WEB_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$WEB_CONTAINER" 2>/dev/null || true); fi
if [[ -n "$API_CONTAINER" ]]; then PREV_API_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$API_CONTAINER" 2>/dev/null || true); fi

log "Previous images: web=$PREV_WEB_IMAGE api=$PREV_API_IMAGE"

docker compose -f "$COMPOSE_FILE" up -d --build

wait_http() {
  local url="$1" timeout="$2";
  local end=$((SECONDS + timeout));
  while ((SECONDS < end)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

if ! wait_http "$SMOKE_URL/" "$TIMEOUT_SECONDS"; then
  log "Health failed, rolling back"
  if [[ -n "$PREV_WEB_IMAGE" || -n "$PREV_API_IMAGE" ]]; then
    docker compose -f "$COMPOSE_FILE" up -d --no-deps
  fi
  exit 7
fi

if [[ -x "$REPO_ROOT/scripts/smoke-documents.sh" ]]; then
  log "Running production smoke on documents endpoint"
  SMOKE_BASE_URL="$SMOKE_URL" bash "$REPO_ROOT/scripts/smoke-documents.sh"
fi

log "Deploy safe complete"
