import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import { isAdminUser, type PublicUser, type UserRepository } from '../auth/userRepository.ts';
import { LeadRoutingValidationError, type LeadRoutingRepository, type LeadRoutingUpdateInput } from './repository.ts';

type LeadRoutingRouteOptions = {
  userRepository: UserRepository;
  leadRoutingRepository: LeadRoutingRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function parseUpdateBody(body: unknown): LeadRoutingUpdateInput {
  const value = body as Partial<LeadRoutingUpdateInput> | null;
  if (!value || typeof value.randomEnabled !== 'boolean' || !Array.isArray(value.userRules)) {
    throw new LeadRoutingValidationError('Invalid lead routing payload');
  }

  return {
    randomEnabled: value.randomEnabled,
    userRules: value.userRules.map((rule) => {
      const item = rule as { userId?: unknown; ruleKey?: unknown };
      if (typeof item.userId !== 'string' || typeof item.ruleKey !== 'string') {
        throw new LeadRoutingValidationError('Invalid lead routing rule');
      }
      return { userId: item.userId, ruleKey: item.ruleKey };
    }),
    pipelineAccess: Array.isArray(value.pipelineAccess)
      ? value.pipelineAccess.map((pipeline) => {
          const item = pipeline as { pipelineKey?: unknown; userIds?: unknown };
          if (typeof item.pipelineKey !== 'string' || !Array.isArray(item.userIds)) {
            throw new LeadRoutingValidationError('Invalid pipeline access rule');
          }
          const userIds = item.userIds.map((userId) => {
            if (typeof userId !== 'string') throw new LeadRoutingValidationError('Invalid pipeline access user');
            return userId;
          });
          return { pipelineKey: item.pipelineKey, userIds };
        })
      : undefined,
  };
}

function handleLeadRoutingError(error: unknown, reply: FastifyReply) {
  if (error instanceof LeadRoutingValidationError) return reply.code(400).send({ error: error.message });
  throw error;
}

export async function registerLeadRoutingRoutes(app: FastifyInstance, options: LeadRoutingRouteOptions): Promise<void> {
  const preHandler = requirePermission('settings.manage', {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  app.get('/api/lead-routing', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const config = await options.leadRoutingRepository.getConfig(user.tenantId);
      return { config };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });

  app.put('/api/lead-routing', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const input = parseUpdateBody(request.body);
      const config = await options.leadRoutingRepository.updateConfig(user.tenantId, user.id, input);
      return { config };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });

  // GET /api/lead-routing/rules - Buscar regras de distribuição
  app.get('/api/lead-routing/rules', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const rules = await options.leadRoutingRepository.getDistributionRules(user.tenantId);
      return { rules };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });

  // PUT /api/lead-routing/rules/:ruleKey - Atualizar regra de distribuição
  app.put('/api/lead-routing/rules/:ruleKey', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const { ruleKey } = request.params as { ruleKey: string };
      const body = request.body as { isActive?: boolean; priority?: number; config?: Record<string, unknown> };
      const rule = await options.leadRoutingRepository.updateDistributionRule(user.tenantId, ruleKey, body);
      return { rule };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });

  // GET /api/lead-routing/rules/:ruleKey/assignments - Buscar atribuições de uma regra
  app.get('/api/lead-routing/rules/:ruleKey/assignments', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const { ruleKey } = request.params as { ruleKey: string };
      const assignments = await options.leadRoutingRepository.getRuleAssignments(user.tenantId, ruleKey);
      return { assignments };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });

  // PUT /api/lead-routing/rules/:ruleKey/assignments/:userId - Atualizar atribuição de regra
  app.put('/api/lead-routing/rules/:ruleKey/assignments/:userId', { preHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Admin access is required' });
      const { ruleKey, userId } = request.params as { ruleKey: string; userId: string };
      const body = request.body as Record<string, unknown>;
      const assignment = await options.leadRoutingRepository.updateRuleAssignment(user.tenantId, ruleKey, userId, body);
      return { assignment };
    } catch (error) {
      return handleLeadRoutingError(error, reply);
    }
  });
}
