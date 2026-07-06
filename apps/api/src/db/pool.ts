import pg from 'pg';
import { readEnv } from '../config/env.ts';

const { Pool } = pg;

// Configurações otimizadas do pool de conexões
const POOL_CONFIG = {
  // Número máximo de conexões no pool
  max: 20,
  // Número mínimo de conexões mantidas no pool
  min: 4,
  // Tempo máximo que uma conexão pode ficar ociosa antes de ser removida (ms)
  idleTimeoutMillis: 30000,
  // Tempo máximo que um cliente espera por uma conexão disponível (ms)
  connectionTimeoutMillis: 5000,
  // Intervalo para verificar conexões ociosas (ms)
  housekeepingIntervalMs: 10000,
};

// Singleton do pool de conexões principal
let mainPool: pg.Pool | null = null;

// Pools adicionais para casos específicos (ex: n8n)
const additionalPools: Map<string, pg.Pool> = new Map();

/**
 * Obtém o pool de conexões principal (singleton)
 * Garante que apenas um pool seja criado para toda a aplicação
 */
export function getDatabasePool(): pg.Pool {
  if (!mainPool) {
    const env = readEnv();
    mainPool = new Pool({
      connectionString: env.databaseUrl,
      ...POOL_CONFIG,
    });

    // Logging de eventos do pool para monitoramento
    mainPool.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB Pool] Nova conexão estabelecida');
      }
    });

    mainPool.on('acquire', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB Pool] Conexão adquirida da fila');
      }
    });

    mainPool.on('remove', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB Pool] Conexão removida do pool');
      }
    });

    // Handler de erros para evitar crash da aplicação
    mainPool.on('error', (err) => {
      console.error('[DB Pool] Erro no pool de conexões:', err.message);
    });
  }

  return mainPool;
}

/**
 * Obtém ou cria um pool adicional para casos específicos
 * @param name - Nome identificador do pool (ex: 'n8n')
 * @param connectionString - String de conexão específica
 */
export function getAdditionalPool(name: string, connectionString: string): pg.Pool {
  const cacheKey = `${name}:${connectionString}`;
  
  const existing = additionalPools.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pool = new Pool({
    connectionString,
    ...POOL_CONFIG,
    // Reduzir pool para conexões secundárias
    max: Math.max(4, POOL_CONFIG.max / 2),
    min: Math.max(2, POOL_CONFIG.min / 2),
  });

  // Handler de erros
  pool.on('error', (err) => {
    console.error(`[DB Pool ${name}] Erro no pool:`, err.message);
  });

  additionalPools.set(cacheKey, pool);
  return pool;
}

/**
 * Fecha todos os pools de conexões
 * Deve ser chamado apenas durante o shutdown da aplicação
 */
export async function closeAllPools(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (mainPool) {
    closePromises.push(
      mainPool.end().then(() => {
        mainPool = null;
        console.log('[DB Pool] Pool principal fechado');
      })
    );
  }

  for (const [name, pool] of additionalPools.entries()) {
    closePromises.push(
      pool.end().then(() => {
        additionalPools.delete(name);
        console.log(`[DB Pool] Pool adicional ${name} fechado`);
      })
    );
  }

  await Promise.all(closePromises);
}

/**
 * Obtém estatísticas do pool para monitoramento
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  activeCount: number;
} {
  if (!mainPool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0, activeCount: 0 };
  }

  return {
    totalCount: mainPool.totalCount,
    idleCount: mainPool.idleCount,
    waitingCount: mainPool.waitingCount,
    activeCount: mainPool.totalCount - mainPool.idleCount,
  };
}
