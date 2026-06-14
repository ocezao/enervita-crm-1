#!/usr/bin/env bash
set -euo pipefail

# Deploy to staging environment for pre-production validation.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/compose.staging.yaml"
ENV_FILE="$REPO_ROOT/.env.prod"
STAGING_DB="enervita_crm_staging"

log() { printf '[deploy-staging] %s\n' "$*"; }
fail() { printf '[deploy-staging][ERRO] %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

# 1. Validate prerequisites
[[ -f "$COMPOSE_FILE" ]] || fail "compose.staging.yaml não encontrado"
[[ -f "$ENV_FILE" ]] || fail ".env.prod não encontrado"

# 2. Ensure staging database exists
log "verificando banco staging..."
PGPASSWORD=$(docker exec enervita-postgres printenv POSTGRES_PASSWORD | tr -d '\n')
docker exec enervita-postgres psql -U enervita_app -d enervita -t -c "SELECT 1 FROM pg_database WHERE datname='$STAGING_DB'" | grep -q 1 || {
  log "criando banco staging..."
  docker exec enervita-postgres createdb -U enervita_app "$STAGING_DB"
  docker exec enervita-postgres pg_dump -U enervita_app -d enervita_crm --schema-only > /tmp/schema_staging.sql 2>/dev/null
  docker exec enervita-postgres psql -U enervita_app -d "$STAGING_DB" -c "$(cat /tmp/schema_staging.sql)" >/dev/null 2>&1
  log "banco staging criado com schema"
}

# 3. Build
log "rodando build..."
npm run build || fail "build falhou"

# 4. Stop existing staging containers
log "parando stack anterior..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down 2>/dev/null || true

# 5. Start staging stack
log "iniciando stack de staging..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api web proxy

# 6. Wait for health
log "aguardando health checks..."
sleep 20

# 7. Verify

# 8. Run migrations on staging
log "executando migrations no staging..."
docker exec enervita-staging-crm-api sh -lc "cd /app && DATABASE_URL=postgres://enervita_app:uUibFxWtVvGDVh2whPTgU5ofLOiY7OSdRBWOrW1XJUioSmp0@enervita-postgres:5432/enervita_crm_staging node apps/api/scripts/db-migrate.mjs" || log "⚠️ migration warning"
API_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' enervita-staging-crm-api 2>/dev/null || echo "unknown")
PROXY_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' enervita-staging-crm-proxy 2>/dev/null || echo "unknown")

log "API: $API_HEALTH | Proxy: $PROXY_HEALTH"

if [[ "$API_HEALTH" == "healthy" && "$PROXY_HEALTH" == "healthy" ]]; then
  log "✅ Staging deploy concluído com sucesso"
  log "API interna: http://localhost:44123/health"
  log "Proxy interna: http://localhost:44210/health"
else
  log "⚠️ Health check falhou - verificar logs"
  docker logs enervita-staging-crm-api --tail 20 2>&1 | tail -10
fi
