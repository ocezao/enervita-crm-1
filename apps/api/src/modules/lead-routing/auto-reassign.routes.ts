import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDatabasePool } from '../../db/pool.ts';
import { requirePermission } from '../../middleware/requireAuth.ts';
import { isAdminUser, type PublicUser, type UserRepository } from '../auth/userRepository.ts';
import pg from 'pg';

const { Pool } = pg;

type AutoReassignRouteOptions = {
  userRepository: UserRepository;
  databaseUrl: string;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

export async function registerAutoReassignRoutes(app: FastifyInstance, options: AutoReassignRouteOptions): Promise<void> {
  const pool = options.databaseUrl ? new Pool({ connectionString: options.databaseUrl }) : getDatabasePool();

  const preHandler = requirePermission('settings.manage', {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  // GET /api/auto-reassign - Buscar configuração atual
  app.get('/api/auto-reassign', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });

      const result = await pool.query(
        `SELECT auto_reassign_enabled as "enabled", auto_reassign_activated_at as "activatedAt", auto_reassign_after_hours as "afterHours"
         FROM pipeline_rules_config WHERE tenant_id = $1 AND pipeline_key = 'geral'`,
        [user.tenantId],
      );

      const config = result.rows[0] ?? { enabled: false, activatedAt: null, afterHours: 168 };

      // Buscar estatísticas de reatribuição
      const stats = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE reassignment_count > 0) as "totalReassigned",
           COUNT(*) FILTER (WHERE reassignment_count >= 3) as "maxedOut",
           COUNT(*) FILTER (WHERE last_activity_at < now() - INTERVAL '7 days' AND stage NOT IN ('contrato_enervita', 'perdido') AND sdr_owner_id IS NOT NULL AND reassignment_count < 3) as "eligibleNow"
         FROM leads WHERE tenant_id = $1`,
        [user.tenantId],
      );

      return {
        config: {
          enabled: config.enabled,
          activatedAt: config.activatedAt,
          afterHours: config.afterHours ?? 168,
        },
        stats: stats.rows[0],
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        return reply.code(403).send({ error: error.message });
      }
      throw error;
    }
  });

  // PUT /api/auto-reassign - Atualizar configuração
  app.put('/api/auto-reassign', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });

      const body = request.body as { enabled?: boolean } | null;
      if (!body || typeof body.enabled !== 'boolean') {
        return reply.code(400).send({ error: 'enabled field is required (boolean)' });
      }

      const { enabled } = body;

      // Atualizar configuração
      await pool.query(
        `UPDATE pipeline_rules_config
         SET auto_reassign_enabled = $1,
             auto_reassign_activated_at = CASE WHEN $1 = true AND auto_reassign_activated_at IS NULL THEN now() ELSE auto_reassign_activated_at END,
             updated_at = now()
         WHERE tenant_id = $2 AND pipeline_key = 'geral'`,
        [enabled, user.tenantId],
      );

      // Buscar config atualizada
      const result = await pool.query(
        `SELECT auto_reassign_enabled as "enabled", auto_reassign_activated_at as "activatedAt"
         FROM pipeline_rules_config WHERE tenant_id = $1 AND pipeline_key = 'geral'`,
        [user.tenantId],
      );

      // Registrar no audit log
      await pool.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
         VALUES ($1, $2, 'system', $3, 'auto_reassign.toggle', $4)`,
        [user.tenantId, user.id, user.tenantId, JSON.stringify({ enabled })],
      );

      return { config: result.rows[0] };
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        return reply.code(403).send({ error: error.message });
      }
      throw error;
    }
  });

  // Cleanup
  app.addHook('onClose', async () => {
    await pool.end();
  });
}
