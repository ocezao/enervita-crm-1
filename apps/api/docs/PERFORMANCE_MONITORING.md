# 📊 Sistema de Monitoramento de Performance

## Visão Geral

O sistema de monitoramento foi implementado para fornecer insights em tempo real sobre a performance da aplicação, permitindo identificação proativa de gargalos e otimizações.

## Funcionalidades Implementadas

### 1. Middleware de Performance (`/src/middleware/performance-monitor.ts`)

Monitora automaticamente todas as requisições HTTP, coletando:
- Tempo de resposta de cada request
- Identificação de queries lentas (>100ms)
- Estatísticas de uso do pool de conexões
- Métricas agregadas (média, máximo, total)

### 2. Rotas de Monitoramento

#### `/metrics/performance`
Retorna métricas detalhadas de performance:
```json
{
  "totalQueries": 1250,
  "slowQueries": 45,
  "averageQueryTime": 87.5,
  "maxQueryTime": 2340,
  "poolUsage": {
    "totalCount": 20,
    "idleCount": 15,
    "activeCount": 5,
    "waitingCount": 0
  },
  "health": {
    "status": "healthy",
    "recommendations": ["Sistema operando dentro dos parâmetros normais"]
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `/health/detailed`
Health check aprimorado com informações de database e performance:
```json
{
  "ok": true,
  "database": {
    "status": "connected",
    "pool": {
      "totalCount": 20,
      "idleCount": 15,
      "activeCount": 5,
      "waitingCount": 0
    }
  },
  "performance": {
    "avgQueryTime": "87ms",
    "slowQueriesLastPeriod": 45
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Sistema de Alertas Automáticos

O monitoramento gera alertas automáticos para:
- **Queries Lentas**: Logs em `console.warn` para requests >100ms
- **Pool Sobrecarregado**: Logs em `console.error` quando `waitingCount > 5`
- **Recomendações Inteligentes**: Sugestões baseadas nas métricas atuais

### 4. Função de Registro Manual

Para queries executadas fora do ciclo HTTP (scripts, workers):
```typescript
import { recordQuery } from './middleware/performance-monitor.js';

const start = Date.now();
await db.query('SELECT ...');
recordQuery(Date.now() - start);
```

## Configuração

### Thresholds Configuráveis

No arquivo `performance-monitor.ts`:
```typescript
const SLOW_QUERY_THRESHOLD_MS = 100; // Ajuste conforme necessário
```

### Níveis de Alerta do Pool

- **Healthy**: `waitingCount <= 5`
- **Warning**: `waitingCount > 5 && waitingCount <= 10`
- **Critical**: `waitingCount > 10`

## Integração com a Aplicação

O middleware foi registrado em `/src/app.ts`:
```typescript
import { registerPerformanceMonitoring } from './middleware/performance-monitor.js';

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 40 * 1024 * 1024 });
  
  // ... configurações ...
  
  // Registra middleware de monitoramento
  registerPerformanceMonitoring(app);
  
  // ... routes ...
}
```

## Uso em Produção

### Coleta de Métricas

Para integrar com sistemas de monitoramento externos (Prometheus, Datadog, etc.):

1. **Endpoint de Métricas**: Configure scrapers para `/metrics/performance`
2. **Logs Estruturados**: Parseie logs do console para sistemas como ELK Stack
3. **Health Checks**: Use `/health/detailed` em load balancers

### Exemplo: Prometheus + Grafana

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'api-performance'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics/performance'
```

### Exemplo: Script de Monitoramento Contínuo

```bash
#!/bin/bash
while true; do
  curl -s http://localhost:3000/metrics/performance | jq '.health'
  sleep 30
done
```

## Recomendações de Otimização

O sistema fornece recomendações automáticas baseadas em:

1. **Pool de Conexões**
   - Se `waitingCount > 5`: Aumentar `max` connections
   - Se `idleCount > 80%`: Reduzir `min` connections

2. **Performance de Queries**
   - Se `slowQueries > 10%`: Revisar índices e queries
   - Se `averageQueryTime > 500ms`: Otimizar queries críticas

3. **Saúde Geral**
   - Status baseado em múltiplas métricas
   - Recomendações acionáveis

## Boas Práticas

### Em Desenvolvimento
- Logs detalhados habilitados (`NODE_ENV=development`)
- Monitore o console para warnings de queries lentas
- Use `/health/detailed` durante testes de carga

### Em Produção
- Integre com sistema de logging centralizado
- Configure alertas baseados em `/metrics/performance`
- Monitore tendências ao longo do tempo
- Ajuste thresholds conforme baseline da aplicação

### Em Staging
- Execute testes de carga antes de deploy
- Valide recomendações do sistema
- Compare métricas antes/depois de otimizações

## Troubleshooting

### Problema: Muitas queries lentas
**Solução:**
1. Acesse `/metrics/performance`
2. Verifique recomendações em `health.recommendations`
3. Revise queries no log de warnings
4. Adicione índices conforme Fase 2 do plano

### Problema: Pool sobrecarregado
**Solução:**
1. Verifique `poolUsage.waitingCount` em `/health/detailed`
2. Aumente `max` em `/src/db/pool.ts` (atual: 20)
3. Identifique queries mantendo conexões abertas
4. Considere read replicas para cargas altas

### Problema: Falso positivo em alerts
**Solução:**
1. Ajuste `SLOW_QUERY_THRESHOLD_MS` conforme baseline
2. Calibre thresholds de alerta do pool
3. Implemente janelas de tempo para alertas

## Próximos Passos Sugeridos

1. **Integração com APM**: New Relic, DataDog, ou OpenTelemetry
2. **Distributed Tracing**: Para microserviços
3. **Alertas Proativos**: Slack/PagerDuty integration
4. **Dashboard em Tempo Real**: Grafana ou similar
5. **Baseline Histórica**: Armazenar métricas para trending

## Segurança

- Endpoints de métricas devem ser protegidos em produção
- Considere autenticação para `/metrics/performance` e `/health/detailed`
- Não exponha detalhes internos em ambientes públicos

## Performance Impact

O middleware foi projetado para impacto mínimo:
- Overhead: <1ms por request
- Armazenamento em memória (sem I/O adicional)
- Cálculos incrementais eficientes
- Thread-safe para operações concorrentes

---

**Status**: ✅ Implementado e integrado
**Versão**: 1.0.0
**Última Atualização**: 2024
