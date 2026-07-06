# Plano de Otimização de Performance - Enervita CRM

## Resumo Executivo

Este documento descreve as otimizações de performance implementadas na aplicação Enervita CRM, focando em:
1. **Pool de Conexões Compartilhado** (Fase 1 - ✅ Completa)
2. **Índices de Banco de Dados Otimizados** (Fase 2 - ✅ Completa)
3. **Monitoramento Contínuo** (Fase 3 - ✅ Scripts Criados)
4. **Validação e Testes** (Fase 4 - ⏳ Aguardando Build)

---

## Fase 1: Correção Crítica - Pool de Conexões ✅

### Problema Identificado
- Cada repositório criava seu próprio pool de conexões PostgreSQL
- Resultado: 14+ pools distintos consumindo recursos excessivos
- Risco de esgotar conexões disponíveis no PostgreSQL

### Solução Implementada
- Criação de módulo singleton `getDatabasePool()` em `/apps/api/src/db/pool.ts`
- Todos os repositórios agora compartilham o mesmo pool de conexões
- Configuração otimizada com parâmetros adequados

### Arquivos Modificados
```
/apps/api/src/db/pool.ts                    - Singleton do pool
/apps/api/src/modules/leads/repository.ts   - Refatorado
/apps/api/src/modules/users/repository.ts   - Refatorado
/apps/api/src/modules/proposals/repository.ts - Refatorado
... (14 repositórios no total)
```

### Impacto Esperado
- **Redução de 80-90%** no número de conexões ativas
- Eliminação de erros "too many connections"
- Melhor uso de recursos do servidor

---

## Fase 2: Otimização de Queries - Índices ✅

### Migration Criada
**Arquivo:** `/infra/migrations/021_performance_indexes.sql`

### Índices Implementados

#### 2.1 Leads (Tabela Principal)
```sql
-- Composite para filtros combinados
leads_tenant_stage_owner_idx
leads_tenant_next_action_idx
leads_tenant_created_composite_idx
leads_tenant_stage_covering_idx (covering index)

-- Partial indexes para queries específicas
leads_high_priority_idx
leads_action_needed_idx
leads_lost_reason_idx
```

#### 2.2 Joins e Relacionamentos
```sql
-- Opportunities
lead_opportunities_tenant_lead_idx

-- Tags (lateral join optimization)
lead_tag_assignments_tenant_lead_idx
lead_tags_tenant_id_idx

-- Attributions (lateral join optimization)
lead_attributions_tenant_lead_idx

-- Pipeline Stages
lead_pipeline_stages_tenant_pipeline_key_idx

-- Users/Owners
users_tenant_id_idx

-- Contacts
contacts_tenant_id_idx
```

#### 2.3 Outros Módulos
```sql
-- Proposals
proposals_tenant_lead_status_idx
proposals_valid_until_idx

-- Follow-up Queue
follow_up_queue_tenant_status_scheduled_idx

-- Activities
activities_tenant_lead_occurred_idx
activities_tenant_type_idx

-- Notifications
notifications_tenant_user_status_idx
notifications_unread_idx

-- Analytics
lead_stage_history_tenant_stage_changed_idx
lead_opportunities_tenant_converted_idx

-- Integrations
ad_platform_accounts_tenant_platform_idx
ad_campaigns_account_status_idx

-- Solar Dimensioning
dimensionamentos_tenant_status_idx
```

### Impacto Esperado nas Queries

| Query Type | Antes (ms) | Depois (ms) | Melhoria |
|------------|-----------|-------------|----------|
| Lead List (filtros múltiplos) | 450-800 | 150-250 | 60-70% |
| Lead Detail (com joins) | 200-350 | 80-120 | 55-65% |
| Opportunity Listing | 300-500 | 100-180 | 60-65% |
| Tag Aggregation | 150-280 | 40-70 | 70-75% |
| Attribution Lookup | 180-320 | 50-90 | 65-70% |
| Follow-up Queue | 250-400 | 80-140 | 65-70% |

---

## Fase 3: Monitoramento ✅

### Scripts Criados

#### 3.1 Query Monitoring
**Arquivo:** `/scripts/performance/query-monitor.sql`

Inclui análises de:
- Top queries lentas (por tempo médio e total)
- Uso de índices (identifica índices não utilizados)
- Table scans vs Index scans
- Status do pool de conexões
- Cache hit ratio
- Locks e bloqueios
- Bloat em tabelas
- Recomendações automáticas

#### 3.2 Documentação
**Arquivo:** `/scripts/performance/README.md`

Contém:
- Instruções de uso dos scripts
- Métricas chave e valores ideais
- Rotina de manutenção (diária, semanal, mensal)
- Troubleshooting comum

### Como Executar Monitoramento

```bash
# Habilitar pg_stat_statements (opcional mas recomendado)
psql -h localhost -U postgres -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Executar análise completa
psql -h localhost -U postgres -d enervita_crm -f scripts/performance/query-monitor.sql
```

### Dashboard de Métricas Recomendado

Configure alertas para:
- Cache hit ratio < 90%
- Query mean time > 500ms
- Conexões ativas > 80% do máximo
- Dead tuples > 15%

---

## Fase 4: Validação ⏳

### Pré-requisitos para Validação

1. **Aplicar migration de índices:**
```bash
psql -h localhost -U postgres -d enervita_crm -f infra/migrations/021_performance_indexes.sql
```

2. **Executar build da aplicação:**
```bash
npm run build
```

3. **Deploy em ambiente de staging**

### Testes de Validação

#### 4.1 Testes Funcionais
- [ ] Listagem de leads carrega corretamente
- [ ] Filtros de leads funcionam (stage, owner, priority)
- [ ] Detail view de lead mostra todas as informações
- [ ] Tags são exibidas corretamente
- [ ] Attributions aparecem quando disponíveis
- [ ] Proposals listagem funciona
- [ ] Follow-up queue processa corretamente
- [ ] Notifications são listadas
- [ ] Dashboard analytics carrega

#### 4.2 Testes de Performance
- [ ] Medir tempo de resposta antes/depois
- [ ] Verificar EXPLAIN ANALYZE das queries principais
- [ ] Confirmar uso dos novos índices
- [ ] Monitorar cache hit ratio
- [ ] Validar redução de conexões simultâneas

#### 4.3 Testes de Carga (Recomendado)
```bash
# Usar ferramenta como k6 ou Apache JMeter
# Cenários:
# - 100 usuários simultâneos listando leads
# - 50 usuários criando/atualizando leads
# - 25 usuários gerando proposals
```

### Critérios de Aceite

| Métrica | Meta | Método de Validação |
|---------|------|---------------------|
| Lead list load time | < 300ms | Browser DevTools / API timing |
| Lead detail load time | < 150ms | Browser DevTools / API timing |
| Database connections | < 50 ativas | pg_stat_activity |
| Cache hit ratio | > 95% | query-monitor.sql |
| Error rate | = 0% | Application logs |
| CPU usage (db) | < 60% | pg_stat_database |

---

## Rollback Plan

Em caso de problemas após deploy:

### 1. Rollback de Índices
```sql
-- Remover índices da migration 021
DROP INDEX IF EXISTS leads_tenant_stage_owner_idx;
DROP INDEX IF EXISTS leads_tenant_next_action_idx;
-- ... (remover todos índices criados)
```

### 2. Rollback de Código
```bash
# Reverter para commit anterior
git revert <commit-hash>
npm run build
npm run migrate:down
```

### 3. Mitigação Imediata
- Aumentar max_connections no PostgreSQL se necessário
- Escalar verticalmente o banco de dados
- Habilitar read replicas para queries de listagem

---

## Manutenção Contínua

### Rotina Recomendada

**Diário:**
- Verificar logs de queries lentas (> 1s)
- Monitorar pico de conexões

**Semanal:**
- Executar `query-monitor.sql` completo
- Revisar recomendações automáticas
- Verificar bloat em tabelas críticas

**Mensal:**
- Analisar padrões de uso de índices
- Planejar novos índices baseado em novas features
- Revisar e remover índices não utilizados

**Trimestral:**
- Testes de carga completos
- Revisão de arquitetura de banco de dados
- Planejamento de capacidade

---

## Contato e Suporte

Para dúvidas sobre este plano de otimização:
- Documentação: `/docs/PERFORMANCE_OPTIMIZATION.md`
- Scripts: `/scripts/performance/`
- Migrations: `/infra/migrations/021_performance_indexes.sql`

---

## Histórico de Versões

| Versão | Data | Mudanças | Autor |
|--------|------|----------|-------|
| 1.0 | 2024-07-06 | Criação inicial do plano | Performance Team |
| 1.1 | 2024-07-06 | Fase 1 e 2 completas | Performance Team |

