import pg from 'pg';

const { Pool } = pg;

export type LeadRoutingService = {
  key: string;
  label: string;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
};

export type LeadRoutingUser = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  roles: string[];
  ruleKey: string;
};

export type LeadRoutingPipeline = {
  key: string;
  label: string;
  userIds: string[];
};

export type DistributionRule = {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  config: Record<string, unknown>;
};

export type DistributionRuleAssignment = {
  ruleKey: string;
  userId: string;
  config: Record<string, unknown>;
};

export type LeadRoutingConfig = {
  randomEnabled: boolean;
  services: LeadRoutingService[];
  users: LeadRoutingUser[];
  pipelines: LeadRoutingPipeline[];
};

export type LeadRoutingUpdateInput = {
  randomEnabled: boolean;
  userRules: Array<{ userId: string; ruleKey: string }>;
  pipelineAccess?: Array<{ pipelineKey: string; userIds: string[] }>;
};

export type LeadRoutingRepository = {
  getConfig(tenantId: string): Promise<LeadRoutingConfig>;
  updateConfig(tenantId: string, actorUserId: string, input: LeadRoutingUpdateInput): Promise<LeadRoutingConfig>;
  getDistributionRules(tenantId: string): Promise<DistributionRule[]>;
  updateDistributionRule(tenantId: string, ruleKey: string, input: { isActive?: boolean; priority?: number; config?: Record<string, unknown> }): Promise<DistributionRule>;
  getRuleAssignments(tenantId: string, ruleKey: string): Promise<DistributionRuleAssignment[]>;
  updateRuleAssignment(tenantId: string, ruleKey: string, userId: string, config: Record<string, unknown>): Promise<DistributionRuleAssignment>;
  close?(): Promise<void>;
};

export class LeadRoutingValidationError extends Error {}

const defaultServices: LeadRoutingService[] = [
  { key: 'assinatura', label: 'Assinatura', keywords: ['assinatura', 'solar por assinatura', 'energia por assinatura'], sortOrder: 10, isActive: true },
  { key: 'solar_proprio', label: 'Sistema proprio / painel solar', keywords: ['painel', 'placa', 'sistema proprio', 'energia solar', 'solar proprio', 'fotovoltaico'], sortOrder: 20, isActive: true },
  { key: 'usina', label: 'Usina solar', keywords: ['usina', 'investimento em usina', 'fazenda solar'], sortOrder: 30, isActive: true },
  { key: 'bateria_backup', label: 'Bateria e backup', keywords: ['bateria', 'backup', 'armazenamento', 'nobreak'], sortOrder: 40, isActive: true },
  { key: 'clube_enervita', label: 'Clube Enervita', keywords: ['clube enervita', 'clube'], sortOrder: 50, isActive: true },
  { key: 'indicacao', label: 'Indicacao', keywords: ['indicacao', 'indicacao', 'indique', 'referencia', 'referral'], sortOrder: 60, isActive: true },
];

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function ensureDefaults(client: pg.PoolClient, tenantId: string): Promise<void> {
  // Garantir que regra "random" existe (não usar mais lead_routing_settings)
  await client.query(
    `INSERT INTO lead_routing_rules (tenant_id, rule_key, rule_name, description, is_active, priority)
     VALUES ($1, 'random', 'Aleatório', 'Atribui leads de forma aleatória entre os vendedores disponíveis.', false, 2)
     ON CONFLICT (tenant_id, rule_key) DO NOTHING`,
    [tenantId],
  );

  for (const service of defaultServices) {
    await client.query(
      `insert into lead_routing_services (tenant_id, key, label, keywords, sort_order, is_active)
       values ($1, $2, $3, $4::jsonb, $5, true)
       on conflict (tenant_id, key) do update
         set label = excluded.label,
             keywords = excluded.keywords,
             sort_order = excluded.sort_order,
             is_active = true,
             updated_at = now()`,
      [tenantId, service.key, service.label, JSON.stringify(service.keywords), service.sortOrder],
    );
  }
}

async function readConfig(client: pg.PoolClient, tenantId: string): Promise<LeadRoutingConfig> {
  await ensureDefaults(client, tenantId);

  const randomRule = await client.query(
    `SELECT is_active FROM lead_routing_rules 
     WHERE tenant_id = $1 AND rule_key = 'random'`,
    [tenantId]
  );

  const services = await client.query(
    `select key, label, keywords, sort_order as "sortOrder", is_active as "isActive"
       from lead_routing_services
      where tenant_id = $1
      order by sort_order asc, label asc`,
    [tenantId],
  );

  const users = await client.query(
    `select u.id::text as id,
            u.name,
            u.email,
            u.status,
            coalesce(array_agg(distinct r.name) filter (where r.name is not null), array[]::text[]) as roles,
            coalesce(rule.rule_key, 'none') as "ruleKey"
       from users u
       left join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
       left join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
       left join lead_routing_user_rules rule on rule.tenant_id = u.tenant_id and rule.user_id = u.id
      where u.tenant_id = $1
        and not exists (
          select 1
            from user_roles admin_ur
            join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
           where admin_ur.tenant_id = u.tenant_id
             and admin_ur.user_id = u.id
             and admin_r.name = 'admin'
        )
      group by u.id, rule.rule_key
      order by u.status desc, u.name asc, u.email asc`,
    [tenantId],
  );

  const pipelines = await client.query(
    `select p.key,
            p.label,
            coalesce(array_agg(access.user_id::text order by u.name) filter (where access.user_id is not null), array[]::text[]) as "userIds"
       from lead_pipelines p
       left join lead_pipeline_user_access access on access.tenant_id = p.tenant_id and access.pipeline_key = p.key
       left join users u on u.tenant_id = access.tenant_id and u.id = access.user_id
      where p.tenant_id = $1
        and p.is_active = true
      group by p.key, p.label, p.sort_order
      order by p.sort_order asc, p.label asc`,
    [tenantId],
  );

  return {
    randomEnabled: Boolean(randomRule.rows[0]?.is_active ?? false),
    services: services.rows.map((row) => ({
      key: row.key as string,
      label: row.label as string,
      keywords: normalizeStringArray(row.keywords),
      sortOrder: Number(row.sortOrder ?? 0),
      isActive: Boolean(row.isActive),
    })),
    users: users.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      status: row.status as 'active' | 'inactive',
      roles: normalizeStringArray(row.roles),
      ruleKey: row.ruleKey as string,
    })),
    pipelines: pipelines.rows.map((row) => ({
      key: row.key as string,
      label: row.label as string,
      userIds: normalizeStringArray(row.userIds),
    })),
  };
}

export function createPgLeadRoutingRepository(databaseUrl: string): LeadRoutingRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getConfig(tenantId) {
      const client = await pool.connect();
      try {
        return await readConfig(client, tenantId);
      } finally {
        client.release();
      }
    },

    async updateConfig(tenantId, actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const current = await readConfig(client, tenantId);
        const allowedRuleKeys = new Set(['none', 'random', ...current.services.filter((service) => service.isActive).map((service) => service.key)]);
        const allowedUserIds = new Set(current.users.map((user) => user.id));
        const allowedPipelineKeys = new Set(current.pipelines.map((pipeline) => pipeline.key));

        if (typeof input.randomEnabled !== 'boolean') {
          throw new LeadRoutingValidationError('randomEnabled must be boolean');
        }

        for (const rule of input.userRules) {
          if (!allowedUserIds.has(rule.userId)) throw new LeadRoutingValidationError('Invalid routing user');
          if (!allowedRuleKeys.has(rule.ruleKey)) throw new LeadRoutingValidationError('Invalid routing rule');
        }
        for (const pipeline of input.pipelineAccess ?? []) {
          if (!allowedPipelineKeys.has(pipeline.pipelineKey)) throw new LeadRoutingValidationError('Invalid pipeline');
          for (const userId of pipeline.userIds) {
            if (!allowedUserIds.has(userId)) throw new LeadRoutingValidationError('Invalid pipeline user');
          }
        }

        // Atualizar regra "random" em vez de setting legado
        await client.query(
          `UPDATE lead_routing_rules SET is_active = $3, updated_at = now()
           WHERE tenant_id = $1 AND rule_key = 'random'`,
          [tenantId, 'random', input.randomEnabled],
        );

        for (const rule of input.userRules) {
          await client.query(
            `insert into lead_routing_user_rules (tenant_id, user_id, rule_key, updated_by, updated_at)
             values ($1, $2, $3, $4, now())
             on conflict (tenant_id, user_id) do update
               set rule_key = excluded.rule_key,
                   updated_by = excluded.updated_by,
                   updated_at = now()`,
            [tenantId, rule.userId, rule.ruleKey, actorUserId],
          );
        }

        if (input.pipelineAccess) {
          for (const pipeline of input.pipelineAccess) {
            await client.query('delete from lead_pipeline_user_access where tenant_id = $1 and pipeline_key = $2', [tenantId, pipeline.pipelineKey]);
            for (const userId of pipeline.userIds) {
              await client.query(
                `insert into lead_pipeline_user_access (tenant_id, pipeline_key, user_id, updated_by, updated_at)
                 values ($1, $2, $3, $4, now())
                 on conflict (tenant_id, pipeline_key, user_id) do update
                   set updated_by = excluded.updated_by,
                       updated_at = now()`,
                [tenantId, pipeline.pipelineKey, userId, actorUserId],
              );
            }
          }
        }

        const updated = await readConfig(client, tenantId);
        await client.query('commit');
        return updated;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async getDistributionRules(tenantId) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT rule_key as key, rule_name as name, description, is_active as "isActive", priority, config
           FROM lead_routing_rules
           WHERE tenant_id = $1
           ORDER BY priority ASC, name ASC`,
          [tenantId]
        );
        return result.rows.map(row => ({
          key: row.key,
          name: row.name,
          description: row.description,
          isActive: row.isActive,
          priority: row.priority,
          config: row.config || {},
        }));
      } finally {
        client.release();
      }
    },

    async updateDistributionRule(tenantId, ruleKey, input) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `UPDATE lead_routing_rules
           SET is_active = COALESCE($3, is_active),
               priority = COALESCE($4, priority),
               config = COALESCE($5, config),
               updated_at = now()
           WHERE tenant_id = $1 AND rule_key = $2
           RETURNING rule_key as key, rule_name as name, description, is_active as "isActive", priority, config`,
          [tenantId, ruleKey, input.isActive, input.priority, input.config ? JSON.stringify(input.config) : null]
        );
        if (result.rows.length === 0) throw new LeadRoutingValidationError('Rule not found');
        return result.rows[0];
      } finally {
        client.release();
      }
    },

    async getRuleAssignments(tenantId, ruleKey) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT rule_key as "ruleKey", user_id as "userId", config
           FROM lead_routing_rule_assignments
           WHERE tenant_id = $1 AND rule_key = $2`,
          [tenantId, ruleKey]
        );
        return result.rows.map(row => ({
          ruleKey: row.ruleKey,
          userId: row.userId,
          config: row.config || {},
        }));
      } finally {
        client.release();
      }
    },

    async updateRuleAssignment(tenantId, ruleKey, userId, config) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO lead_routing_rule_assignments (tenant_id, rule_key, user_id, config)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, rule_key, user_id)
           DO UPDATE SET config = $4, updated_at = now()
           RETURNING rule_key as "ruleKey", user_id as "userId", config`,
          [tenantId, ruleKey, userId, JSON.stringify(config)]
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}

export function createStaticLeadRoutingRepository(initialConfig?: Partial<LeadRoutingConfig>): LeadRoutingRepository {
  let config: LeadRoutingConfig = {
    randomEnabled: initialConfig?.randomEnabled ?? true,
    services: initialConfig?.services ?? defaultServices,
    users: initialConfig?.users ?? [],
    pipelines: initialConfig?.pipelines ?? [],
  };

  return {
    async getConfig() {
      return config;
    },
    async updateConfig(_tenantId, _actorUserId, input) {
      const rules = new Map(input.userRules.map((rule) => [rule.userId, rule.ruleKey]));
      config = {
        ...config,
        randomEnabled: input.randomEnabled,
        users: config.users.map((user) => ({ ...user, ruleKey: rules.get(user.id) ?? user.ruleKey })),
        pipelines: input.pipelineAccess
          ? config.pipelines.map((pipeline) => ({ ...pipeline, userIds: input.pipelineAccess?.find((item) => item.pipelineKey === pipeline.key)?.userIds ?? pipeline.userIds }))
          : config.pipelines,
      };
      return config;
    },
    async getDistributionRules() {
      return [];
    },
    async updateDistributionRule() {
      throw new LeadRoutingValidationError('Static repository does not support distribution rules');
    },
    async getRuleAssignments() {
      return [];
    },
    async updateRuleAssignment() {
      throw new LeadRoutingValidationError('Static repository does not support rule assignments');
    },
  };
}
