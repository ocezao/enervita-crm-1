#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy seguro do frontend público do CRM Enervita.
# Codifica explicitamente o container público legado para evitar deploy no compose/preview errado.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_CONTAINER="${PUBLIC_CONTAINER:-enervita-crm-consolidated}"
PUBLIC_DIST="${PUBLIC_DIST:-/app/apps/web/dist}"
PUBLIC_URL="${PUBLIC_URL:-https://crm.enervita.com.br}"
LOCAL_DIST="${LOCAL_DIST:-$REPO_ROOT/apps/web/dist}"
EXPECTED_DB_HOST="${EXPECTED_DB_HOST:-enervita-postgres}"
DRY_RUN=0
SKIP_BUILD=0
SKIP_SMOKE=0

usage() {
  cat <<'USAGE'
Uso:
  scripts/deploy-public-web.sh [--dry-run] [--skip-build] [--skip-smoke]

O que faz:
  1. Confirma que o container público é enervita-crm-consolidated.
  2. Confirma que o processo público aponta para o banco enervita-postgres.
  3. Roda npm run build, salvo --skip-build.
  4. Faz backup do dist atual dentro do container.
  5. Copia apps/web/dist para /app/apps/web/dist do container público.
  6. Roda smoke HTTP nas rotas públicas principais.

Variáveis opcionais:
  PUBLIC_CONTAINER=enervita-crm-consolidated
  PUBLIC_DIST=/app/apps/web/dist
  PUBLIC_URL=https://crm.enervita.com.br
  EXPECTED_DB_HOST=enervita-postgres
USAGE
}

log() { printf '[deploy-public-web] %s\n' "$*"; }
fail() { printf '[deploy-public-web] ERRO: %s\n' "$*" >&2; exit 1; }
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] %q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-smoke) SKIP_SMOKE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "argumento desconhecido: $1" ;;
  esac
  shift
done

cd "$REPO_ROOT"

command -v docker >/dev/null || fail "docker não encontrado"
command -v npm >/dev/null || fail "npm não encontrado"
command -v curl >/dev/null || fail "curl não encontrado"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "não está dentro de um repo git"

docker inspect "$PUBLIC_CONTAINER" >/dev/null 2>&1 || fail "container público não encontrado: $PUBLIC_CONTAINER"
state="$(docker inspect -f '{{.State.Running}}' "$PUBLIC_CONTAINER")"
[[ "$state" == "true" ]] || fail "container público não está rodando: $PUBLIC_CONTAINER"

# Trava contra o erro que aconteceu: deploy no container certo, banco público certo.
if docker exec "$PUBLIC_CONTAINER" sh -lc 'for p in /proc/[0-9]*; do cmd=$(tr "\0" " " < "$p/cmdline" 2>/dev/null || true); case "$cmd" in *"tsx src/server.ts"*) tr "\0" "\n" < "$p/environ" | grep -E "^DATABASE_URL=" | head -1; exit 0;; esac; done; exit 1' >/tmp/enervita_public_db_env.$$ 2>/dev/null; then
  db_env="$(cat /tmp/enervita_public_db_env.$$)"
  rm -f /tmp/enervita_public_db_env.$$
  case "$db_env" in
    *"@$EXPECTED_DB_HOST:"*) log "banco público confirmado: $EXPECTED_DB_HOST" ;;
    *) fail "DATABASE_URL do público não aponta para $EXPECTED_DB_HOST. Valor redigido: $(printf '%s' "$db_env" | sed -E 's#(://[^:]+:)[^@]+#\1***#g')" ;;
  esac
else
  rm -f /tmp/enervita_public_db_env.$$ 2>/dev/null || true
  fail "não consegui ler DATABASE_URL do processo público no container $PUBLIC_CONTAINER"
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  log "rodando build frontend"
  npm run build
else
  log "build pulado por --skip-build"
fi

[[ -d "$LOCAL_DIST" ]] || fail "dist local não existe: $LOCAL_DIST"
[[ -f "$LOCAL_DIST/index.html" ]] || fail "index.html não encontrado em $LOCAL_DIST"
asset_count="$(find "$LOCAL_DIST/assets" -type f 2>/dev/null | wc -l | tr -d ' ')"
[[ "$asset_count" -gt 0 ]] || fail "nenhum asset encontrado em $LOCAL_DIST/assets"

local_index_sha="$(sha256sum "$LOCAL_DIST/index.html" | awk '{print $1}')"
log "dist local OK: assets=$asset_count index_sha256=$local_index_sha"

backup_path="/tmp/enervita-web-dist-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
log "criando backup do dist atual no container: $backup_path"
run docker exec "$PUBLIC_CONTAINER" sh -lc "test -d '$PUBLIC_DIST' && tar -C '$(dirname "$PUBLIC_DIST")' -czf '$backup_path' '$(basename "$PUBLIC_DIST")'"

log "publicando dist no container público $PUBLIC_CONTAINER:$PUBLIC_DIST"
run docker exec "$PUBLIC_CONTAINER" sh -lc "mkdir -p '$PUBLIC_DIST'"
run docker cp "$LOCAL_DIST/." "$PUBLIC_CONTAINER:$PUBLIC_DIST/"

if [[ "$DRY_RUN" != "1" ]]; then
  remote_index_sha="$(docker exec "$PUBLIC_CONTAINER" sh -lc "sha256sum '$PUBLIC_DIST/index.html' | awk '{print \$1}'")"
  [[ "$remote_index_sha" == "$local_index_sha" ]] || fail "sha do index no container diverge: local=$local_index_sha remoto=$remote_index_sha"
  log "dist publicado e verificado: index_sha256=$remote_index_sha"
fi

if [[ "$SKIP_SMOKE" != "1" ]]; then
  log "rodando smoke público"
  routes=("/" "/login" "/pipeline" "/leads" "/proposals" "/version.json")
  for route in "${routes[@]}"; do
    code="$(curl -k -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL$route")"
    [[ "$code" == "200" ]] || fail "smoke falhou: $route retornou HTTP $code"
    log "smoke OK: $route $code"
  done
else
  log "smoke pulado por --skip-smoke"
fi

log "deploy público concluído: $PUBLIC_URL"
