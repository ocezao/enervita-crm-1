#!/usr/bin/env bash
set -euo pipefail

# Deploy production CRM using separated compose stack (P5 Phase 1).
# Migrates from enervita-crm-consolidated to compose.prod.yaml services.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/compose.prod.yaml"
ENV_FILE="$REPO_ROOT/.env.prod"
OLD_CONTAINER="enervita-crm-consolidated"
PROXY_CONTAINER="enervita-prod-crm-proxy"
PUBLIC_URL="https://crm.enervita.com.br"

log() { printf '[deploy-p5] %s\n' "$*"; }
fail() { printf '[deploy-p5][ERRO] %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

# 1. Validate prerequisites
[[ -f "$COMPOSE_FILE" ]] || fail "compose.prod.yaml não encontrado"
[[ -f "$ENV_FILE" ]] || fail ".env.prod não encontrado"
docker inspect "$OLD_CONTAINER" >/dev/null 2>&1 || fail "container legado não encontrado: $OLD_CONTAINER"

# 2. Build
log "rodando build..."
npm run build || fail "build falhou"

# 3. Backup current state
log "criando backup do estado atual..."
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
docker exec "$OLD_CONTAINER" sh -lc "cp -r /app/apps/web/dist /tmp/web-dist-backup-${BACKUP_TS}" 2>/dev/null || true

# 4. Stop old container (graceful)
log "parando container legado..."
docker stop "$OLD_CONTAINER" 2>/dev/null || true

# 5. Start new compose stack
log "iniciando nova stack de produção..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres api web proxy notification-runner lead-sync meta-leadgen meta-capi

# 6. Wait for health
log "aguardando health checks..."
sleep 15

# 7. Verify API health
API_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' enervita-prod-crm-api 2>/dev/null || echo "unknown")
PROXY_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' enervita-prod-crm-proxy 2>/dev/null || echo "unknown")

if [[ "$API_HEALTH" != "healthy" ]]; then
  log "⚠️ API health: $API_HEALTH"
fi
if [[ "$PROXY_HEALTH" != "healthy" ]]; then
  log "⚠️ Proxy health: $PROXY_HEALTH"
fi

# 8. Update Caddy to point to new proxy
log "atualizando Caddy para nova stack..."
docker exec agencia-caddy sed -i 's/enervita-crm-consolidated:43210/enervita-prod-crm-proxy:43210/g' /etc/caddy/Caddyfile
docker exec agencia-caddy caddy validate --config /etc/caddy/Caddyfile && \
docker exec agencia-caddy caddy reload --config /etc/caddy/Caddyfile || fail "reload Caddy falhou"

# 9. Verify public endpoint
sleep 3
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log "✅ Deploy P5 concluído. $PUBLIC_URL retorna HTTP $HTTP_CODE"
else
  log "⚠️ HTTP $HTTP_CODE em $PUBLIC_URL - verificar logs"
fi

# 10. Keep old container as fallback (don't remove yet)
log "container legado mantido como fallback: $OLD_CONTAINER"
log "para remover depois de 24h de validação: docker rm $OLD_CONTAINER"
