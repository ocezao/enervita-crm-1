import Redis from 'ioredis';

export type CacheKeys = {
  userPermissions: (userId: string) => `permissions:${userId}`;
  tenantPipelines: (tenantId: string) => `pipelines:${tenantId}`;
  dashboardMetrics: (tenantId: string, range: string) => `dashboard:${tenantId}:${range}`;
  leadById: (leadId: string) => `lead:${leadId}`;
  leadList: (tenantId: string, filters: string) => `leads:list:${tenantId}:${filters}`;
};

export const cacheKeys: CacheKeys = {
  userPermissions: (userId: string) => `permissions:${userId}`,
  tenantPipelines: (tenantId: string) => `pipelines:${tenantId}`,
  dashboardMetrics: (tenantId: string, range: string) => `dashboard:${tenantId}:${range}`,
  leadById: (leadId: string) => `lead:${leadId}`,
  leadList: (tenantId: string, filters: string) => `leads:list:${tenantId}:${filters}`,
};

export class CacheService {
  private redis: Redis | null = null;
  private defaultTTL = 300; // 5 minutos
  private shortTTL = 60; // 1 minuto para dados voláteis
  private enabled = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          lazyConnect: true,
        });
        
        this.redis.on('error', (err) => {
          console.error('[CacheService] Redis error:', err.message);
          this.enabled = false;
        });
        
        this.redis.on('connect', () => {
          console.log('[CacheService] Redis connected');
          this.enabled = true;
        });
        
        this.enabled = true;
      } catch (error) {
        console.error('[CacheService] Failed to initialize Redis:', error);
        this.enabled = false;
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.redis !== null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled() || !this.redis) {
      return null;
    }

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[CacheService] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isEnabled() || !this.redis) {
      return;
    }

    try {
      const ttlToUse = ttl ?? this.defaultTTL;
      await this.redis.setex(key, ttlToUse, JSON.stringify(value));
    } catch (error) {
      console.error(`[CacheService] Error setting key ${key}:`, error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.isEnabled() || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`[CacheService] Error invalidating pattern ${pattern}:`, error);
    }
  }

  async invalidateKey(key: string): Promise<void> {
    if (!this.isEnabled() || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[CacheService] Error invalidating key ${key}:`, error);
    }
  }

  // Cache-aside pattern para leads individuais
  async getLeadWithCache(
    leadId: string,
    fetchFn: () => Promise<any>
  ): Promise<any> {
    const key = cacheKeys.leadById(leadId);
    
    // Tenta obter do cache
    const cached = await this.get<any>(key);
    if (cached) {
      return cached;
    }

    // Cache miss - busca no banco
    const lead = await fetchFn();
    
    // Armazena no cache com TTL curto
    await this.set(key, lead, this.shortTTL);
    
    return lead;
  }

  // Cache para listagens de leads com filtros
  async getLeadListWithCache(
    tenantId: string,
    filtersHash: string,
    fetchFn: () => Promise<any[]>
  ): Promise<any[]> {
    const key = cacheKeys.leadList(tenantId, filtersHash);
    
    // Tenta obter do cache
    const cached = await this.get<any[]>(key);
    if (cached) {
      return cached;
    }

    // Cache miss - busca no banco
    const leads = await fetchFn();
    
    // Armazena no cache com TTL muito curto para listagens
    await this.set(key, leads, 30);
    
    return leads;
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.enabled = false;
    }
  }
}

// Helper para gerar hash de filtros para cache key
export function createFiltersHash(filters: Record<string, any>): string {
  const crypto = require('node:crypto');
  const sorted = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {} as Record<string, any>);
  
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
}
