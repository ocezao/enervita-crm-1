# Guia de Deploy - Otimização de Performance

## 📋 Visão Geral

Este documento descreve o procedimento seguro para aplicar as otimizações de performance desenvolvidas nas Fases 1-3.

**Data de Criação**: 2026-07-06  
**Versão**: 1.0  
**Responsável**: Time de Engenharia

---

## 🎯 Mudanças Incluídas

### Fase 1: Pool de Conexões Singleton
- Centralização de todas conexões PostgreSQL em um único pool
- Configurações otimizadas (max: 20, min: 4, timeouts)
- Eliminação de 19+ pools distintos

### Fase 2: Índices de Performance
- 26+ índices para otimização de queries
- Foco em leads, proposals, followups, notifications
- Índices compostos, parciais e covering

### Fase 3: Monitoramento
- Middleware de performance tracking
- Alertas automáticos para slow queries e pool overload
- Rotas de métricas (`/metrics/performance`, `/health/detailed`)

---

## ⚠️ Pré-Requisitos

1. **Backup do banco de dados** realizado nas últimas 24h
2. **Ambiente de staging** disponível para testes
3. **Janela de manutenção** agendada (se necessário)
4. **Equipe de plantão** para monitoramento pós-deploy
5. **Espaço em disco** suficiente no servidor (>500MB livres)

---

## 🚀 Procedimento de Deploy

### Passo 1: Aplicar Migration em Staging

```bash
# Conectar ao banco de staging
export DATABASE_URL="postgres://..."

# Executar migration
npm run db:migrate

# Verificar se migration foi aplicada com sucesso
psql -c "SELECT version FROM schema_migrations WHERE version = '021_performance_indexes';"
```

**Critério de Sucesso**: 
- Migration completada sem erros
- Registro adicionado em `schema_migrations`

### Passo 2: Validar Criação dos Índices

```sql
-- Listar todos índices criados
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%_idx'
ORDER BY tablename, indexname;

-- Contar índices por tabela
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%_idx'
GROUP BY tablename
ORDER BY index_count DESC;
```

**Critério de Sucesso**:
- 26+ índices listados
- Todas tabelas críticas indexadas

### Passo 3: Deploy da Aplicação

```bash
# Build da aplicação (apenas após validações estáticas)
npm run build

# Deploy em staging
# (procedimento específico do seu ambiente de deploy)

# Reiniciar aplicação para carregar novo código
pm2 restart enervita-api
# ou
systemctl restart enervita-api
```

### Passo 4: Validar Funcionamento em Staging

#### 4.1 Health Checks

```bash
# Health check básico
curl https://staging-api.enervita.com.br/health

# Health check detalhado (pool stats)
curl https://staging-api.enervita.com.br/health/detailed | jq .
```

**Resposta Esperada**:
```json
{
  "ok": true,
  "database": {
    "status": "connected",
    "pool": {
      "totalCount": 4-20,
      "idleCount": >0,
      "activeCount": <20,
      "waitingCount": 0
    }
  },
  "performance": {
    "avgQueryTime": "~100ms",
    "slowQueriesLastPeriod": 0
  }
}
```

#### 4.2 Métricas de Performance

```bash
# Acessar métricas detalhadas
curl https://staging-api.enervita.com.br/metrics/performance | jq .
```

**Verificar**:
- `totalQueries`: aumentando conforme uso
- `slowQueries`: <5% do total
- `averageQueryTime`: <200ms
- `poolUsage.waitingCount`: 0 ou próximo de 0
- `health.status`: "healthy"

#### 4.3 Testes Funcionais

Executar testes críticos:
- [ ] Listagem de leads (filtragem, paginação)
- [ ] Detalhe de lead completo
- [ ] Criação de proposta
- [ ] Queue de follow-ups
- [ ] Notificações
- [ ] Dashboard/analytics
- [ ] Integrações (Meta CAPI, n8n)

**Critério de Sucesso**:
- Todas funcionalidades operacionais
- Response times dentro do esperado (<500ms p95)
- Sem erros no log da aplicação

### Passo 5: Testes de Carga (Opcional mas Recomendado)

```bash
# Usando k6 ou similar
k6 run load-tests/leads-list.js

# Ou manualmente com múltiplas requisições simultâneas
for i in {1..50}; do
  curl -s https://staging-api.enervita.com.br/api/leads &
done
wait
```

**Métricas para Observar**:
- Response time médio sob carga
- Comportamento do pool (waitingCount)
- Eventuais timeout errors

### Passo 6: Rollback Plan (Se Necessário)

Se problemas críticos forem detectados:

```bash
# Opção 1: Reverter apenas índices (dados preservados)
psql -f infra/migrations/021_performance_indexes_rollback.sql

# Opção 2: Rollback completo da aplicação
git revert <commit-hash>
npm run build
pm2 restart enervita-api

# Opção 3: Restore de backup (último recurso)
pg_restore -d enervita_crm backup_file.dump
```

### Passo 7: Deploy em Produção

Após validação bem-sucedida em staging (mínimo 24h):

1. **Comunicar stakeholders** sobre janela de deploy
2. **Aplicar migration em produção**
   ```bash
   npm run db:migrate
   ```
3. **Deploy da aplicação**
   ```bash
   npm run build
   # (procedimento de deploy em produção)
   ```
4. **Monitoramento intensivo** nas primeiras 2-4 horas
5. **Validar métricas** comparando com baseline

---

## 📊 Monitoramento Pós-Deploy

### Checklist de Validação (Primeiras 24h)

- [ ] Pool de conexões estável (1 pool ativo)
- [ ] Sem erros "too many connections"
- [ ] Avg response time <200ms
- [ ] Slow queries <5% do total
- [ ] Pool waitingCount ≈ 0
- [ ] Health checks retornando "healthy"
- [ ] Logs sem warnings críticos
- [ ] Usuários reportando melhoria de performance

### Dashboards Recomendados

Criar dashboard com:
1. **Pool Usage Over Time** (active, idle, waiting)
2. **Response Time Percentiles** (p50, p95, p99)
3. **Slow Query Count** (por hora)
4. **Error Rate** (HTTP 5xx, timeouts)
5. **Request Volume** (req/min)

### Alertas Configurados

Configurar alertas para:
- ⚠️ Pool waitingCount > 5 por >5min
- 🔴 Pool waitingCount > 10 por >2min
- ⚠️ Avg query time > 500ms por >10min
- 🔴 Error rate > 1% por >5min
- ⚠️ Slow queries > 10% do total

---

## 🔧 Troubleshooting

### Problema: Pool WaitingCount Alto

**Causas Possíveis**:
- Queries muito lentas travando conexões
- Max connections muito baixo para carga atual
- Vazamento de conexões (não liberadas)

**Ações**:
1. Verificar logs de slow queries
2. Aumentar `DB_POOL_MAX` via env variable
3. Revisar queries em execução: 
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC;
   ```

### Problema: Muitas Slow Queries

**Causas Possíveis**:
- Índices não aplicados corretamente
- Estatísticas do banco desatualizadas
- Queries não otimizadas

**Ações**:
1. Confirmar criação dos índices
2. Executar ANALYZE nas tabelas:
   ```sql
   ANALYZE leads;
   ANALYZE contacts;
   -- etc...
   ```
3. Usar EXPLAIN ANALYZE em queries lentas

### Problema: Erros de Conexão

**Causas Possíveis**:
- Banco de dados sobrecarregado
- Network issues
- Connection timeout muito curto

**Ações**:
1. Verificar saúde do PostgreSQL
2. Aumentar `DB_POOL_CONNECTION_TIMEOUT`
3. Checar network latency

---

## 📈 Métricas de Sucesso

Comparar antes/depois (produção):

| Métrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Pools Ativos | 19+ | 1 | Logs da aplicação |
| Max Conexões | 380+ | 20 | `pg_stat_activity` |
| Avg Response Time | ~200ms | <150ms | `/metrics/performance` |
| Slow Queries (%) | ? | <5% | Middleware logs |
| Erros "too many connections" | Frequentes | 0 | Application logs |
| User complaints | ? | Redução 50% | Feedback/Suporte |

---

## 📝 Lições Aprendidas

*(Preencher após deploy em produção)*

- O que funcionou bem?
- Quais desafios encontrados?
- Melhorias para próximos deploys?

---

## 🔗 Referências

- [PERFORMANCE_MONITORING.md](./apps/api/docs/PERFORMANCE_MONITORING.md)
- [PRE_BUILD_CHECKLIST.md](./PRE_BUILD_CHECKLIST.md)
- [Migration 021](./infra/migrations/021_performance_indexes.sql)
- [Rollback Script](./infra/migrations/021_performance_indexes_rollback.sql)

---

**Aprovado por**: ________________  
**Data de Aprovação**: ________________  
**Próxima Revisão**: 2026-12-06
