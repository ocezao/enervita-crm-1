import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPoolStats } from '../db/pool.js';

type QueryMetrics = {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  maxQueryTime: number;
  poolUsage: {
    totalCount: number;
    idleCount: number;
    activeCount: number;
    waitingCount: number;
  };
};

// Armazena métricas em memória (em produção, usar Redis ou banco)
const metrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  averageQueryTime: 0,
  maxQueryTime: 0,
  poolUsage: {
    totalCount: 0,
    idleCount: 0,
    activeCount: 0,
    waitingCount: 0,
  },
};

const SLOW_QUERY_THRESHOLD_MS = 100; // Queries acima de 100ms são consideradas lentas

/**
 * Middleware para monitorar performance de queries e pool de conexões
 */
export function registerPerformanceMonitoring(app: FastifyInstance): void {
  // Decorator para armazenar tempo de início da request
  app.decorateRequest('startTime', null as any);

  // Hook antes de cada request
  app.addHook('onRequest', async (request: FastifyRequest & { startTime?: number }, _reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  // Hook após cada request
  app.addHook('onResponse', async (request: FastifyRequest & { startTime?: number }, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    
    // Atualiza métricas globais
    metrics.totalQueries++;
    metrics.averageQueryTime = (metrics.averageQueryTime * (metrics.totalQueries - 1) + duration) / metrics.totalQueries;
    metrics.maxQueryTime = Math.max(metrics.maxQueryTime, duration);

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      metrics.slowQueries++;
      
      // Log detalhado de queries lentas
      console.warn('[PERF] Request lenta detectada:', {
        method: request.method,
        url: request.url,
        duration: `${duration}ms`,
        statusCode: reply.statusCode,
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });
    }

    // Atualiza estatísticas do pool
    const poolStats = getPoolStats();
    metrics.poolUsage = poolStats;

    // Alerta se pool estiver sobrecarregado
    if (poolStats.waitingCount > 5) {
      console.error('[PERF ALERT] Pool de conexões sobrecarregado!', {
        waiting: poolStats.waitingCount,
        active: poolStats.activeCount,
        idle: poolStats.idleCount,
        total: poolStats.totalCount,
      });
    }
  });

  // Rota para expor métricas de performance
  app.get('/metrics/performance', async () => {
    const poolStats = getPoolStats();
    return {
      ...metrics,
      poolUsage: poolStats,
      health: {
        status: poolStats.waitingCount > 10 ? 'critical' : poolStats.waitingCount > 5 ? 'warning' : 'healthy',
        recommendations: generateRecommendations(poolStats, metrics),
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Rota para health check detalhado
  app.get('/health/detailed', async () => {
    const poolStats = getPoolStats();
    return {
      ok: true,
      database: {
        status: poolStats.totalCount > 0 ? 'connected' : 'disconnected',
        pool: poolStats,
      },
      performance: {
        avgQueryTime: `${Math.round(metrics.averageQueryTime)}ms`,
        slowQueriesLastPeriod: metrics.slowQueries,
      },
      timestamp: new Date().toISOString(),
    };
  });

  console.log('[MONITORING] Performance monitoring enabled');
}

/**
 * Gera recomendações baseadas nas métricas atuais
 */
function generateRecommendations(poolStats: ReturnType<typeof getPoolStats>, currentMetrics: QueryMetrics): string[] {
  const recommendations: string[] = [];

  if (poolStats.waitingCount > 5) {
    recommendations.push('Aumentar max connections do pool (atual: 20)');
  }

  if (poolStats.idleCount > poolStats.totalCount * 0.8 && poolStats.totalCount > 10) {
    recommendations.push('Reduzir min connections do pool para economizar recursos');
  }

  if (currentMetrics.slowQueries > currentMetrics.totalQueries * 0.1 && currentMetrics.totalQueries > 100) {
    recommendations.push('Mais de 10% das queries estão lentas - revisar índices e queries');
  }

  if (currentMetrics.averageQueryTime > 500) {
    recommendations.push('Tempo médio de query muito alto (>500ms) - otimizar queries críticas');
  }

  if (recommendations.length === 0) {
    recommendations.push('Sistema operando dentro dos parâmetros normais');
  }

  return recommendations;
}

/**
 * Exporta função para registrar query manual (para queries fora do ciclo HTTP)
 */
export function recordQuery(duration: number): void {
  metrics.totalQueries++;
  metrics.averageQueryTime = (metrics.averageQueryTime * (metrics.totalQueries - 1) + duration) / metrics.totalQueries;
  metrics.maxQueryTime = Math.max(metrics.maxQueryTime, duration);

  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    metrics.slowQueries++;
    console.warn('[PERF] Query lenta registrada:', { duration: `${duration}ms` });
  }
}
