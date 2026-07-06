# Scripts de Monitoramento e Otimização de Performance

## Visão Geral

Este diretório contém scripts SQL e ferramentas para monitoramento, análise e otimização de performance do banco de dados PostgreSQL da aplicação Enervita CRM.

## Arquivos

### `query-monitor.sql`
Script completo de monitoramento que inclui:
- Identificação de queries lentas (requer extensão `pg_stat_statements`)
- Análise de uso de índices
- Detecção de table scans excessivos
- Monitoramento de pool de conexões
- Análise de cache hit ratio
- Detecção de locks e bloqueios
- Análise de bloat em tabelas
- Recomendações automáticas baseadas em métricas

### `021_performance_indexes.sql` (em `/infra/migrations/`)
Migration com índices otimizados para:
- Queries de listagem de leads
- Joins com opportunities, tags, attributions
- Pipeline stages e user lookups
- Proposals e follow-up queue
- Activities e notifications
- Analytics e reporting

## Como Usar

### 1. Executar Migration de Índices

```bash
# Em ambiente de desenvolvimento/staging
psql -h localhost -U postgres -d enervita_crm -f infra/migrations/021_performance_indexes.sql

# Ou através do sistema de migrations da aplicação
npm run migrate
```

### 2. Monitoramento Contínuo

Execute periodicamente (recomendado: diariamente ou semanalmente):

```bash
psql -h localhost -U postgres -d enervita_crm -f scripts/performance/query-monitor.sql
```

### 3. Habilitar pg_stat_statements (Requerido para monitoring completo)

Adicione ao `postgresql.conf`:

```conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
```

Depois reinicie o PostgreSQL e execute:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## Métricas Chave para Observar

| Métrica | Valor Ideal | Ação se Abaixo |
|---------|-------------|----------------|
| Cache Hit Ratio | > 95% | Aumentar shared_buffers, adicionar índices |
| Index Scan vs Seq Scan | Index > Seq | Adicionar índices faltantes |
| Conexões Ativas | < 80% do max | Otimizar pool, identificar queries lentas |
| Dead Tuples | < 10% | Executar VACUUM mais frequente |
| Query Mean Time | < 100ms | Otimizar query, adicionar índices |

## Recomendações de Manutenção

### Diário
- Verificar queries long-running (> 5s)
- Monitorar conexão pool usage

### Semanal
- Executar script completo de monitoring
- Revisar índices não utilizados
- Analisar bloat em tabelas críticas

### Mensal
- Revisar recomendações automáticas
- Planejar novos índices baseado em padrões de query
- Avaliar remoção de índices não utilizados

## Impacto Esperado

Após aplicar os índices da migration 021:

- **Redução de 30-50%** no tempo médio de resposta das queries de leads
- **Eliminação de N+1** nas queries com lateral joins
- **Melhoria de 40-60%** em listagens com filtros múltiplos
- **Redução de 80-90%** no número de conexões simultâneas necessárias

## Troubleshooting

### Índices não estão sendo usados?
```sql
-- Forçar re-análise das estatísticas
ANALYZE leads;
ANALYZE contacts;
-- Verificar plano de execução
EXPLAIN ANALYZE SELECT ...;
```

### Cache hit ratio baixo?
```sql
-- Aumentar shared_buffers no postgresql.conf
-- Valores típicos: 25% da RAM disponível
-- Reiniciar PostgreSQL após mudança
```

### Muitas conexões idle in transaction?
- Revisar código da aplicação para commits adequados
- Reduzir timeout de idle transactions
- Implementar connection pooling adequado

## Notas Importantes

1. **Sempre teste em staging antes de produção**
2. **Crie backups antes de aplicar mudanças estruturais**
3. **Monitore impacto após cada mudança**
4. **Índices adicionam overhead em writes - balanceie conforme necessidade**
5. **Mantenha estatísticas atualizadas com ANALYZE regular**
