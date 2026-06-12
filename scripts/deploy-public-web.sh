#!/usr/bin/env bash
set -euo pipefail

# Deploy público do CRM Enervita no container consolidado.
# Publica frontend + backend para evitar o problema "UI nova + API velha".

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_CONTAINER="${PUBLIC_CONTAINER:-enervita-crm-consolidated}"
PUBLIC_URL="${PUBLIC_URL:-https://crm.enervita.com.br}"
PUBLIC_APP_ROOT="${PUBLIC_APP_ROOT:-/app}"
PUBLIC_WEB_DIST="${PUBLIC_WEB_DIST:-$PUBLIC_APP_ROOT/apps/web/dist}"
LOCAL_WEB_DIST="${LOCAL_WEB_DIST:-$REPO_ROOT/apps/web/dist}"
SKIP_BUILD="false"
SKIP_API="false"
SKIP_WEB="false"

usage() {
  cat <<USAGE
Uso: $0 [--skip-build] [--skip-api] [--skip-web]

Variáveis:
  PUBLIC_CONTAINER  Container público. Padrão: enervita-crm-consolidated
  PUBLIC_URL        URL pública. Padrão: https://crm.enervita.com.br
  PUBLIC_APP_ROOT   Raiz da aplicação no container. Padrão: /app
  PUBLIC_WEB_DIST   Dist público no container. Padrão: /app/apps/web/dist
  LOCAL_WEB_DIST    Dist local. Padrão: apps/web/dist

O script:
  1. valida container público;
  2. roda build local, salvo --skip-build;
  3. cria backups de web dist e API src no container;
  4. publica frontend;
  5. publica backend TypeScript usado pelo tsx;
  6. reinicia crm-api e crm-web via supervisor;
  7. valida domínio público e endpoint protegido.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD="true" ;;
    --skip-api) SKIP_API="true" ;;
    --skip-web) SKIP_WEB="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

log() { printf '[deploy-public-crm] %s\n' "$*"; }
fail() { printf '[deploy-public-crm][erro] %s\n' "$*" >&2; exit 1; }
run() { log "+ $*"; "$@"; }

cd "$REPO_ROOT"

command -v docker >/dev/null || fail "docker não encontrado"
command -v npm >/dev/null || fail "npm não encontrado"
command -v curl >/dev/null || fail "curl não encontrado"
command -v sha256sum >/dev/null || fail "sha256sum não encontrado"

docker inspect "$PUBLIC_CONTAINER" >/dev/null 2>&1 || fail "container público não encontrado: $PUBLIC_CONTAINER"
[[ "$(docker inspect -f '{{.State.Running}}' "$PUBLIC_CONTAINER")" == "true" ]] || fail "container público não está rodando: $PUBLIC_CONTAINER"

docker exec "$PUBLIC_CONTAINER" sh -lc "test -d '$PUBLIC_APP_ROOT/apps/api/src'" || fail "API pública não encontrada em $PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/api/src"
docker exec "$PUBLIC_CONTAINER" sh -lc "test -d '$PUBLIC_APP_ROOT/apps/web'" || fail "Web público não encontrado em $PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/web"
docker exec "$PUBLIC_CONTAINER" sh -lc "test -S /tmp/supervisor.sock" || fail "supervisor do container público não está disponível"

if [[ "$SKIP_BUILD" != "true" ]]; then
  log "rodando build local"
  run npm run build
fi

if [[ "$SKIP_WEB" != "true" ]]; then
  [[ -d "$LOCAL_WEB_DIST" ]] || fail "dist local não existe: $LOCAL_WEB_DIST"
  [[ -f "$LOCAL_WEB_DIST/index.html" ]] || fail "index.html não encontrado em $LOCAL_WEB_DIST"
  [[ -d "$LOCAL_WEB_DIST/assets" ]] || fail "assets não encontrado em $LOCAL_WEB_DIST"
  asset_count="$(find "$LOCAL_WEB_DIST/assets" -type f | wc -l | tr -d ' ')"
  [[ "$asset_count" -gt 0 ]] || fail "nenhum asset encontrado em $LOCAL_WEB_DIST/assets"

  local_index_sha="$(sha256sum "$LOCAL_WEB_DIST/index.html" | awk '{print $1}')"
  web_backup="/tmp/enervita-web-dist-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"

  log "criando backup do frontend público em $web_backup"
  run docker exec "$PUBLIC_CONTAINER" sh -lc "test -d '$PUBLIC_WEB_DIST' && tar -C '$(dirname "$PUBLIC_WEB_DIST")' -czf '$web_backup' '$(basename "$PUBLIC_WEB_DIST")' || true"

  log "publicando frontend em $PUBLIC_CONTAINER:$PUBLIC_WEB_DIST"
  run docker exec "$PUBLIC_CONTAINER" sh -lc "rm -rf '$PUBLIC_WEB_DIST' && mkdir -p '$PUBLIC_WEB_DIST'"
  run docker cp "$LOCAL_WEB_DIST/." "$PUBLIC_CONTAINER:$PUBLIC_WEB_DIST/"

  remote_index_sha="$(docker exec "$PUBLIC_CONTAINER" sh -lc "sha256sum '$PUBLIC_WEB_DIST/index.html' | awk '{print \$1}'")"
  [[ "$local_index_sha" == "$remote_index_sha" ]] || fail "hash do index.html divergiu após cópia"
fi

if [[ "$SKIP_API" != "true" ]]; then
  api_backup="/tmp/enervita-api-src-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  log "criando backup da API pública em $api_backup"
  run docker exec "$PUBLIC_CONTAINER" sh -lc "tar -C '$PUBLIC_APP_ROOT/apps/api' -czf '$api_backup' src package.json tsconfig.json 2>/dev/null || tar -C '$PUBLIC_APP_ROOT/apps/api' -czf '$api_backup' src"

  log "publicando backend em $PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/api"
  run docker exec "$PUBLIC_CONTAINER" sh -lc "mkdir -p '$PUBLIC_APP_ROOT/apps/api/src' '$PUBLIC_APP_ROOT/packages/shared/src'"
  run docker cp "$REPO_ROOT/apps/api/src/." "$PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/api/src/"
  run docker cp "$REPO_ROOT/apps/api/package.json" "$PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/api/package.json"
  run docker cp "$REPO_ROOT/apps/api/tsconfig.json" "$PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/apps/api/tsconfig.json"
  if [[ -d "$REPO_ROOT/packages/shared/src" ]]; then
    run docker cp "$REPO_ROOT/packages/shared/src/." "$PUBLIC_CONTAINER:$PUBLIC_APP_ROOT/packages/shared/src/"
  fi
fi

log "reiniciando serviços públicos necessários"
if [[ "$SKIP_API" != "true" ]]; then
  run docker exec "$PUBLIC_CONTAINER" sh -lc "supervisorctl -c /etc/supervisor/conf.d/crm-supervisord.conf restart crm-api"
fi
if [[ "$SKIP_WEB" != "true" ]]; then
  run docker exec "$PUBLIC_CONTAINER" sh -lc "supervisorctl -c /etc/supervisor/conf.d/crm-supervisord.conf restart crm-web"
fi

log "aguardando serviços públicos"
for service in crm-api crm-web crm-proxy; do
  for attempt in $(seq 1 30); do
    status="$(docker exec "$PUBLIC_CONTAINER" sh -lc "supervisorctl -c /etc/supervisor/conf.d/crm-supervisord.conf status '$service' | awk '{print \$2}'" 2>/dev/null || true)"
    [[ "$status" == "RUNNING" ]] && break
    sleep 1
    [[ "$attempt" == "30" ]] && fail "$service não ficou RUNNING"
  done
done

log "validando domínio público"
root_code="$(curl -k -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/")"
[[ "$root_code" == "200" ]] || fail "GET / retornou HTTP $root_code"

dashboard_code="$(curl -k -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/api/dashboard")"
[[ "$dashboard_code" == "401" || "$dashboard_code" == "403" ]] || fail "GET /api/dashboard sem sessão deveria ser 401/403, retornou HTTP $dashboard_code"

log "deploy público concluído"
log "root HTTP: $root_code | dashboard sem sessão HTTP: $dashboard_code"
