# Plano de Melhoria de Performance - Enervita CRM

## 📊 Resumo Executivo

Após análise detalhada do código da aplicação, identifiquei **oportunidades críticas de otimização** que podem melhorar significativamente a performance, especialmente em cenários de alta carga e crescimento de dados.

---

## 🔍 Análise Atual

### Arquitetura Identificada
- **Backend**: Node.js + TypeScript + Fastify
- **Banco de Dados**: PostgreSQL
- **Frontend**: React + Vite
- **Padrão**: Repository Pattern com transações explícitas

### Pontos Críticos Identificados

1. **Queries SQL sem índices adequados** no repositório de leads
2. **N+1 queries** em operações de listagem
3. **Conexões de banco** abertas/fechadas por operação
4. **Falta de cache** para dados frequentemente acessados
5. **Queries complexas** sem materialized views
6. **Processamento síncrono** de eventos não críticos
7. **Body limit alto** (40MB) sem compressão configurada

---

## 🚀 Plano de Otimização

### FASE 1: Otimizações de Banco de Dados (Impacto Imediato - Alto)

#### 1.1 Índices Estratégicos

**Problema**: Falta de índices compostos para filtros comuns

```sql
-- Migration: 021_performance_indexes.sql

-- Leads: filtro combinado tenant + stage + owner + updated_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_stage_owner_updated_idx 
ON leads(tenant_id, stage, sdr_owner_id, updated_at DESC);

-- Leads: filtro por pipeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_pipeline_idx 
ON leads(tenant_id, pipeline_key, created_at DESC);

-- Lead tags: join optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_tag_assignments_lead_idx 
ON lead_tag_assignments(tenant_id, lead_id, tag_id);

-- Audit logs: query por entidade específica
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_entity_created_idx 
ON audit_logs(tenant_id, entity_type, entity_id, created_at DESC);

-- Contacts: busca por email/phone
CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_tenant_lower_email_idx 
ON contacts(tenant_id, lower(email));

-- Lead attributions: lookup por lead_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_attributions_lead_idx 
ON lead_attributions(lead_id, created_at DESC);

-- Opportunities: join com leads
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_opportunities_lead_idx 
ON lead_opportunities(tenant_id, lead_id, status);
```

**Benefício Esperado**: 60-80% de redução no tempo de queries de listagem

#### 1.2 Query Optimization - Lead Select

**Problema Atual**: Query `leadSelect` (linhas 408-501) faz múltiplos LEFT JOINs e subqueries laterais para CADA lead retornado.

**Solução**: Refatorar para usar CTEs ou dividir em 2 queries

```typescript
// ANTES: Uma query gigante com joins aninhados
const leadSelect = `select l.id, ..., coalesce(tag_rows.tags, '[]'::jsonb) as tags, attribution_row.attribution
                     from leads l
                     left join lateral (select jsonb_agg(...) from lead_tag_assignments ...) tag_rows on true
                     left join lateral (select jsonb_build_object(...) from lead_attributions ...) attribution_row on true`;

// DEPOIS: Query principal + batch loading
async function listLeadsOptimized(tenantId, filters) {
  // 1. Query principal sem dados aninhados
  const leads = await client.query(`
    SELECT l.id, l.tenant_id, l.contact_id, l.stage, l.pipeline_key, 
           l.sdr_owner_id, l.created_at, l.updated_at, ...
    FROM leads l
    WHERE l.tenant_id = $1 AND ...
    ORDER BY l.updated_at DESC
    LIMIT $2 OFFSET $3
  `, [tenantId, limit, offset]);

  // 2. Batch load tags para todos os leads
  const leadIds = leads.rows.map(r => r.id);
  const tags = await client.query(`
    SELECT lta.lead_id, jsonb_agg(jsonb_build_object('id', lt.id, 'name', lt.name, 'slug', lt.slug, 'color', lt.color)) as tags
    FROM lead_tag_assignments lta
    JOIN lead_tags lt ON lt.tenant_id = lta.tenant_id AND lt.id = lta.tag_id
    WHERE lta.tenant_id = $1 AND lta.lead_id = ANY($2)
    GROUP BY lta.lead_id
  `, [tenantId, leadIds]);

  // 3. Batch load attributions
  const attributions = await client.query(`
    DISTINCT ON (la.lead_id) la.lead_id, la.* 
    FROM lead_attributions la
    WHERE la.tenant_id = $1 AND la.lead_id = ANY($2)
    ORDER BY la.lead_id, la.created_at DESC
  `, [tenantId, leadIds]);

  // 4. Merge em memória
  return mergeLeadData(leads.rows, tags.rows, attributions.rows);
}
```

**Benefício Esperado**: 40-50% de redução no tempo de resposta para listas grandes

#### 1.3 Connection Pooling Otimizado

**Problema**: Cada repository operation abre/conecta pool connections individualmente

**Solução**: Configurar pool compartilhado com parâmetros otimizados

```typescript
// config/database.ts
import pg from 'pg';

const { Pool } = pg;

export function createOptimizedPool(databaseUrl: string, maxConnections = 20) {
  return new Pool({
    connectionString: databaseUrl,
    max: maxConnections,                    // Default: 10 → Aumentar para 20-30
    min: 5,                                 // Manter conexões mínimas ativas
    idleTimeoutMillis: 30000,               // 30s antes de liberar conexão ociosa
    connectionTimeoutMillis: 5000,          // Timeout de 5s para obter conexão
    statement_timeout: 30000,               // Queries > 30s são canceladas
    query_timeout: 30000,
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
  });
}

// Uso compartilhado no app.ts
const dbPool = createOptimizedPool(env.databaseUrl);

// Passar pool para repositories em vez de connection string
export function createPgLeadsRepository(pool: Pool): LeadsRepository {
  // Usar pool compartilhado
}
```

**Benefício Esperado**: Redução de overhead de conexão, melhor throughput

---

### FASE 2: Cache Strategy (Impacto Médio-Alto)

#### 2.1 Redis Cache para Dados Quentes

**Cenários ideais para cache**:
- Listas de usuários ativos por tenant
- Permissões/cargos de usuário
- Pipeline stages configuration
- Dashboard aggregations (últimas 24h)

```typescript
// services/cache.ts
import Redis from 'ioredis';

export type CacheKeys = {
  userPermissions: (userId: string) => `permissions:${userId}`;
  tenantPipelines: (tenantId: string) => `pipelines:${tenantId}`;
  dashboardMetrics: (tenantId: string, range: string) => `dashboard:${tenantId}:${range}`;
  leadById: (leadId: string) => `lead:${leadId}`;
};

export class CacheService {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutos

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.redis.setex(key, ttl ?? this.defaultTTL, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Cache-aside pattern para leads
  async getLeadWithCache(leadId: string, fetchFn: () => Promise<Lead>): Promise<Lead> {
    const key = `lead:${leadId}`;
    const cached = await this.get<Lead>(key);
    if (cached) return cached;
    
    const lead = await fetchFn();
    await this.set(key, lead, 60); // TTL curto para leads
    return lead;
  }
}
```

**Implementação no app.ts**:
```typescript
import { CacheService } from './services/cache.ts';

const cacheService = env.redisUrl ? new CacheService(env.redisUrl) : null;

// Incluir nas opções do app
export type CreateAppOptions = {
  // ... existing options
  cacheService?: CacheService;
};
```

**Benefício Esperado**: 70-90% de redução em reads repetidas

#### 2.2 HTTP Cache Headers

```typescript
// middleware/cacheHeaders.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerCacheHeaders(app: FastifyInstance): void {
  // Cache estático para assets
  app.addHook('onSend', async (request, reply, payload) => {
    const url = request.raw.url;
    
    // Assets estáticos (JS, CSS, images)
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/.test(url)) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }
    
    // API responses - depende do endpoint
    if (url.startsWith('/api/leads') && request.method === 'GET') {
      // Listagens: cache curto
      if (!url.includes('/:id')) {
        reply.header('Cache-Control', 'private, max-age=30, must-revalidate');
        reply.header('Vary', 'Authorization, Accept');
      } else {
        // Lead individual: sem cache ou muito curto
        reply.header('Cache-Control', 'private, max-age=10, must-revalidate');
      }
    }
  });
}
```

---

### FASE 3: Processamento Assíncrono (Impacto Médio)

#### 3.1 Background Jobs para Tarefas Não-Críticas

**Problema**: Eventos Meta CAPI e cálculos de score bloqueiam response

**Solução**: Queue-based processing com Bull/BullMQ

```typescript
// queues/stageEventsQueue.ts
import { Queue, Worker } from 'bullmq';

export interface StageEventJob {
  tenantId: string;
  leadId: string;
  action: 'created' | 'stage_changed';
  payload: Record<string, unknown>;
}

export function createStageEventsQueue(redisUrl: string) {
  const queue = new Queue('meta-stage-events', { connection: { url: redisUrl } });
  
  const worker = new Worker('meta-stage-events', async (job: Job<StageEventJob>) => {
    const { tenantId, leadId, payload } = job.data;
    
    // Enviar para Meta CAPI
    await sendToMetaCAPI(payload);
    
    // Marcar como enviado no banco
    await markTrackingEventSent(tenantId, leadId);
  }, { connection: { url: redisUrl } });

  return { queue, worker };
}

// Usage no repository
async function queueMetaStageEvent(client, context, lead, action, fromStage) {
  const payload = buildMetaStageEventPayload(lead, context, action, fromStage);
  
  // Ao invés de INSERT direto, adicionar à fila
  await stageEventsQueue.add('send-meta-event', {
    tenantId: context.tenantId,
    leadId: lead.id,
    action,
    payload,
  }, {
    delay: action === 'stage_changed' ? 10 * 60 * 1000 : 0, // 10min delay para stage changes
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
```

**Benefício Esperado**: Response times 50-70% mais rápidos para operações de stage change

#### 3.2 Debounce de Operações em Lote

```typescript
// services/batchProcessor.ts
export class BatchProcessor {
  private pendingOperations = new Map<string, Array<() => Promise<void>>>();
  private timers = new Map<string, NodeJS.Timeout>();

  enqueue(key: string, operation: () => Promise<void>, delayMs = 100): void {
    if (!this.pendingOperations.has(key)) {
      this.pendingOperations.set(key, []);
    }
    this.pendingOperations.get(key)!.push(operation);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    this.timers.set(key, setTimeout(() => {
      this.flush(key);
    }, delayMs));
  }

  private async flush(key: string): Promise<void> {
    const operations = this.pendingOperations.get(key) || [];
    this.pendingOperations.delete(key);
    this.timers.delete(key);

    // Executar em paralelo
    await Promise.all(operations.map(op => op()));
  }
}

// Uso: Agrupar updates de同一个 lead
batchProcessor.enqueue(`lead:${leadId}`, async () => {
  await updateLeadScore(leadId);
});
```

---

### FASE 4: Otimizações de Código (Impacto Médio-Baixo)

#### 4.1 Lazy Loading de Repositórios

**Problema**: Todos os repositories são inicializados no startup, mesmo se não usados

**Solução**: Factory pattern com lazy initialization

```typescript
// repositories/repositoryFactory.ts
export class RepositoryFactory {
  private pools: Map<string, any> = new Map();
  private repos: Map<string, any> = new Map();

  constructor(private databaseUrl: string) {}

  getLeadsRepository(): LeadsRepository {
    if (!this.repos.has('leads')) {
      const pool = this.getPooledConnection('leads');
      this.repos.set('leads', createPgLeadsRepository(pool));
    }
    return this.repos.get('leads');
  }

  private getPooledConnection(name: string) {
    if (!this.pools.has(name)) {
      this.pools.set(name, new Pool({ connectionString: this.databaseUrl, max: 10 }));
    }
    return this.pools.get(name);
  }

  async close(): Promise<void> {
    for (const pool of this.pools.values()) {
      await pool.end();
    }
  }
}
```

#### 4.2 Compression Middleware

```typescript
// app.ts - Adicionar compressão
import fastifyCompress from '@fastify/compress';

app.register(fastifyCompress, {
  global: true,
  threshold: 1024, // Comprimir respostas > 1KB
  encodings: ['gzip', 'deflate', 'br'], // Brotli para melhor compressão
});
```

**Benefício**: 60-80% de redução no tamanho de respostas JSON

#### 4.3 Request Validation Optimization

**Problema**: Validações Zod/Joi podem ser custosas em loops grandes

**Solução**: Schema compilation prévia e validação em lote

```typescript
// validation/optimizedValidation.ts
import { z } from 'zod';

// Compilar schemas uma vez
const compiledSchemas = {
  createLead: z.object({...}).compile(),
  updateLead: z.object({...}).compile(),
};

export function validateCreateLeadBatch(inputs: unknown[]) {
  return inputs.map(input => {
    const result = compiledSchemas.createLead.safeParse(input);
    if (!result.success) {
      throw new ValidationError(result.error.message);
    }
    return result.data;
  });
}
```

---

### FASE 5: Monitoramento e Observabilidade (Crítico para Produção)

#### 5.1 Query Performance Monitoring

```typescript
// middleware/queryLogger.ts
import type { FastifyInstance } from 'fastify';

export function registerQueryLogging(app: FastifyInstance, pool: Pool): void {
  pool.on('query', (query) => {
    app.log.debug({ query: query.text, params: query.values }, 'DB Query');
  });

  pool.on('error', (err, client) => {
    app.log.error({ error: err.message }, 'DB Pool Error');
  });

  // Slow query logging
  const originalQuery = pool.query.bind(pool);
  pool.query = async (...args) => {
    const start = Date.now();
    try {
      return await originalQuery(...args);
    } finally {
      const duration = Date.now() - start;
      if (duration > 1000) {
        app.log.warn({ duration, query: args[0] }, 'Slow Query Detected');
      }
    }
  };
}
```

#### 5.2 Metrics Collection

```typescript
// middleware/metrics.ts
import client from 'prom-client';

export function registerMetrics(app: FastifyInstance): void {
  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  });

  const dbQueryDuration = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
  });

  app.addHook('onResponse', (request, reply) => {
    httpRequestDuration
      .labels(request.method, request.routeOptions.url, reply.statusCode)
      .observe(reply.elapsedTime / 1000);
  });

  // Expor métricas
  app.get('/metrics', async () => {
    return client.register.metrics();
  });
}
```

---

## 📈 KPIs e Metas de Performance

| Métrica | Atual (Estimado) | Meta | Prioridade |
|---------|------------------|------|------------|
| List Leads (pág. 50) | 800-1500ms | < 200ms | Alta |
| Get Lead by ID | 200-400ms | < 50ms | Alta |
| Change Stage | 500-1000ms | < 200ms | Alta |
| Create Lead | 300-600ms | < 150ms | Média |
| Dashboard Load | 2000-5000ms | < 500ms | Alta |
| Requests/segundo | ~50-100 | 300-500 | Média |
| P95 Latency | ~1500ms | < 300ms | Alta |
| DB Connection Wait | 50-200ms | < 10ms | Média |

---

## 🗓️ Cronograma Sugerido

### Semana 1-2: Fundações
- [ ] Criar índices estratégicos (migration 021)
- [ ] Configurar connection pooling otimizado
- [ ] Implementar slow query logging
- [ ] Setup básico de métricas Prometheus

### Semana 3-4: Otimizações Core
- [ ] Refatorar query `leadSelect` para batch loading
- [ ] Implementar Redis cache para usuários/permissões
- [ ] Adicionar compressão HTTP
- [ ] Otimizar endpoints de listagem com paginação cursor-based

### Semana 5-6: Async Processing
- [ ] Setup BullMQ com Redis
- [ ] Migrar eventos Meta CAPI para fila
- [ ] Implementar debounce para operações em lote
- [ ] Background job para cálculo de scores

### Semana 7-8: Polish & Monitoramento
- [ ] Dashboard de métricas (Grafana)
- [ ] Alertas de performance (P95 > threshold)
- [ ] Load testing com k6/Artillery
- [ ] Documentação de runbooks para incidentes

---

## 🛠️ Tecnologias Recomendadas

| Categoria | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Cache | Redis (ioredis) | Baixa latência, suporte a pub/sub |
| Queue | BullMQ | Baseado em Redis, maduro, TypeScript-first |
| Metrics | Prometheus + Grafana | Standard da indústria, visualização rica |
| APM | OpenTelemetry | Vendor-neutral, tracing distribuído |
| Load Testing | k6 | Scriptable, CI-friendly |
| Compression | @fastify/compress | Brotli + gzip automático |

---

## ⚠️ Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Índices quebram queries existentes | Médio | Testar em staging com EXPLAIN ANALYZE |
| Cache stale em leads | Alto | TTLs curtos (30-60s), invalidação por evento |
| Redis indisponível | Alto | Fallback para DB, circuit breaker |
| Migration de schema | Alto | CREATE INDEX CONCURRENTLY, rollback plan |
| Memory leak em pools | Médio | Monitorar heap, limits configurados |

---

## 📝 Próximos Passos Imediatos

1. **Hoje**: Criar migration de índices (021_performance_indexes.sql)
2. **Esta semana**: 
   - Instrumentar queries com logging de duração
   - Rodar EXPLAIN ANALYZE nas queries principais
   - Baseline de performance atual (k6 test)
3. **Próxima sprint**: Implementar connection pooling + Redis cache

---

## 📚 Referências

- [Fastify Performance Best Practices](https://www.fastify.io/docs/latest/Guides/Performance/)
- [PostgreSQL Indexing Strategies](https://www.postgresql.org/docs/current/indexes.html)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

*Documento gerado em: $(date)*
*Responsável: Tech Lead / Engineering Team*
