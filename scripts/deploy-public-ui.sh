#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="enervita-crm"
DOMAIN="https://crm.enervita.com.br"
PUBLIC_CONTAINER="enervita-crm-consolidated"
LOCAL_DIST="apps/web/dist"
REMOTE_DIST="/app/apps/web/dist"
VAULT_DIR="/home/deploy/repos/agencia-vault/06-VPS/deploys"
FEATURES="${FEATURES:-crm-ui}"
EXPECT_MARKERS=()
ROUTES=()
SKIP_BROWSER=0

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-public-ui.sh [--expect TEXT] [--route PATH] [--skip-browser]

Builds Enervita CRM web, generates version.json, backs up and copies dist to the public container,
verifies markers inside the public container and through the public domain, optionally runs browser screenshots,
and writes a vault deploy report. Rolls back dist automatically if a required check fails after backup.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect) EXPECT_MARKERS+=("$2"); shift 2 ;;
    --route) ROUTES+=("$2"); shift 2 ;;
    --skip-browser) SKIP_BROWSER=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ ${#EXPECT_MARKERS[@]} -eq 0 ]]; then
  EXPECT_MARKERS=("Enervita")
fi
if [[ ${#ROUTES[@]} -eq 0 ]]; then
  ROUTES=("/dashboard")
fi

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 127; }; }
require_cmd docker
require_cmd npm
require_cmd curl
require_cmd jq

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

BRANCH="$(git branch --show-current)"
COMMIT="$(git rev-parse --short HEAD)"
FULL_COMMIT="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_ID="${APP_NAME}-${STAMP}-${COMMIT}"
REPORT_DIR="${ROOT_DIR}/.deploy-reports/${DEPLOY_ID}"
REPORT_MD="${REPORT_DIR}/report.md"
VAULT_REPORT="${VAULT_DIR}/${DEPLOY_ID}.md"
BACKUP_DIR="${REMOTE_DIST}.bak-${STAMP}"
TMP_DIST="/tmp/${DEPLOY_ID}-dist"
ROLLBACK_NEEDED=0

mkdir -p "$REPORT_DIR" "$VAULT_DIR"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "${REPORT_DIR}/deploy.log"; }
fail() { log "FAIL: $*"; exit 1; }
rollback() {
  if [[ "$ROLLBACK_NEEDED" == "1" ]]; then
    log "Rolling back public dist from ${BACKUP_DIR}"
    docker exec "$PUBLIC_CONTAINER" sh -lc "rm -rf '$REMOTE_DIST' && if [ -d '$BACKUP_DIR' ]; then mv '$BACKUP_DIR' '$REMOTE_DIST'; fi" || true
  fi
}
trap rollback ERR

log "Deploy ${DEPLOY_ID} started"
log "Branch=${BRANCH} Commit=${COMMIT} Container=${PUBLIC_CONTAINER} Domain=${DOMAIN}"

docker inspect "$PUBLIC_CONTAINER" >/dev/null 2>&1 || fail "Public container not found: ${PUBLIC_CONTAINER}"

log "Running web build"
npm run build --workspace @enervita/web | tee "${REPORT_DIR}/build.log"

[[ -d "$LOCAL_DIST" ]] || fail "Local dist missing: ${LOCAL_DIST}"

cat > "${LOCAL_DIST}/version.json" <<JSON
{
  "app": "${APP_NAME}",
  "branch": "${BRANCH}",
  "commit": "${COMMIT}",
  "fullCommit": "${FULL_COMMIT}",
  "deployedAt": "${STAMP}",
  "deployedBy": "hermes",
  "features": $(printf '%s' "$FEATURES" | jq -R 'split(",") | map(select(length > 0))')
}
JSON

log "Generated version.json"
cp -a "$LOCAL_DIST" "$TMP_DIST"

log "Backing up current public dist to ${BACKUP_DIR}"
docker exec "$PUBLIC_CONTAINER" sh -lc "rm -rf '$BACKUP_DIR' && if [ -d '$REMOTE_DIST' ]; then cp -a '$REMOTE_DIST' '$BACKUP_DIR'; fi && rm -rf '$REMOTE_DIST' && mkdir -p '$REMOTE_DIST'"
ROLLBACK_NEEDED=1

log "Copying dist into public container"
docker cp "${TMP_DIST}/." "${PUBLIC_CONTAINER}:${REMOTE_DIST}/"

log "Verifying version.json inside public container"
REMOTE_VERSION="$(docker exec "$PUBLIC_CONTAINER" sh -lc "cat '${REMOTE_DIST}/version.json'" | tee "${REPORT_DIR}/container-version.json")"
echo "$REMOTE_VERSION" | jq -e --arg commit "$COMMIT" '.commit == $commit' >/dev/null || fail "Container version.json commit mismatch"

for marker in "${EXPECT_MARKERS[@]}"; do
  log "Checking marker inside container: ${marker}"
  docker exec -e MARKER="$marker" -e REMOTE_DIST="$REMOTE_DIST" "$PUBLIC_CONTAINER" sh -lc 'grep -R -- "$MARKER" "$REMOTE_DIST" >/dev/null' || fail "Marker missing inside container: ${marker}"
done

log "Checking public domain version.json"
PUBLIC_VERSION="$(curl -fsSL "${DOMAIN}/version.json" | tee "${REPORT_DIR}/public-version.json")" || fail "Public version.json unavailable"
echo "$PUBLIC_VERSION" | jq -e --arg commit "$COMMIT" '.commit == $commit' >/dev/null || fail "Public version.json commit mismatch"

log "Checking public routes"
for route in "${ROUTES[@]}"; do
  code="$(curl -k -sS -o "${REPORT_DIR}/route-${route//\//_}.html" -w '%{http_code}' "${DOMAIN}${route}")"
  [[ "$code" == "200" ]] || fail "Route ${route} returned HTTP ${code}"
done

SCREENSHOT_DIR="${REPORT_DIR}/screenshots"
mkdir -p "$SCREENSHOT_DIR"
if [[ "$SKIP_BROWSER" == "0" ]]; then
  log "Running browser smoke screenshots"
  smoke_args=(--domain "$DOMAIN" --output-dir "$SCREENSHOT_DIR")
  for route in "${ROUTES[@]}"; do smoke_args+=(--route "$route"); done
  for marker in "${EXPECT_MARKERS[@]}"; do smoke_args+=(--expect "$marker"); done
  SMOKE_PASSWORD="${SMOKE_PASSWORD:-}" scripts/smoke-public-ui.sh "${smoke_args[@]}" | tee "${REPORT_DIR}/browser-smoke.log"
fi

ROLLBACK_NEEDED=0

cat > "$REPORT_MD" <<MD
---
title: Deploy UI ${APP_NAME} ${STAMP}
type: deploy
cliente: Enervita
status: concluido
---

# Deploy UI ${APP_NAME} — ${STAMP}

- Domínio: ${DOMAIN}
- Container público: ${PUBLIC_CONTAINER}
- Remote dist: ${REMOTE_DIST}
- Backup anterior: ${BACKUP_DIR}
- Branch: ${BRANCH}
- Commit: ${COMMIT}
- Features: ${FEATURES}

## Checks

- Build web: OK
- version.json no container: OK
- version.json no domínio público: OK
- Marcadores: $(printf '`%s` ' "${EXPECT_MARKERS[@]}")
- Rotas: $(printf '`%s` ' "${ROUTES[@]}")
- Browser smoke: $([[ "$SKIP_BROWSER" == "0" ]] && echo OK || echo SKIPPED)

## Evidências

- Log local: ${REPORT_DIR}/deploy.log
- Screenshots: ${SCREENSHOT_DIR}

## Rollback manual

\`\`\`bash
docker exec ${PUBLIC_CONTAINER} sh -lc 'rm -rf ${REMOTE_DIST} && mv ${BACKUP_DIR} ${REMOTE_DIST}'
\`\`\`
MD
cp "$REPORT_MD" "$VAULT_REPORT"
log "Vault report written: ${VAULT_REPORT}"
log "Deploy ${DEPLOY_ID} completed"
