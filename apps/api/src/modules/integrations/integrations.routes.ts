import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { AuditContext } from '../users/repository.ts';
import { IntegrationNotFoundError, N8nUnavailableError, type IntegrationsRepository } from './repository.ts';

type IntegrationsRouteOptions = {
  userRepository: UserRepository;
  integrationsRepository: IntegrationsRepository;
  sessionSecret: string;
};

function handleIntegrationError(error: unknown, reply: FastifyReply) {
  if (error instanceof IntegrationNotFoundError) return reply.code(404).send({ error: error.message });
  if (error instanceof N8nUnavailableError) return reply.code(503).send({ error: error.message });
  throw error;
}

function contextFromRequest(request: FastifyRequest): AuditContext {
  const user = (request as FastifyRequest & { authenticatedUser?: PublicUser }).authenticatedUser;
  if (!user) throw new Error('Authenticated user not found in request context');
  return {
    actorUserId: user.id,
    tenantId: user.tenantId,
    ipAddress: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  };
}

export async function registerIntegrationsRoutes(app: FastifyInstance, options: IntegrationsRouteOptions): Promise<void> {
  const automationsPreHandler = requirePermission('page.automations', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const automationManagePreHandler = requirePermission('automation.manage', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const webhooksPreHandler = requirePermission('page.webhooks', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const webhookTestPreHandler = requirePermission('webhook.test', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/automations', { preHandler: automationsPreHandler }, async (request) => {
    const context = contextFromRequest(request);
    return { automations: await options.integrationsRepository.listAutomations(context.tenantId) };
  });


  app.get('/api/automations/n8n-workflows', { preHandler: automationsPreHandler }, async () => {
    try {
      return { workflows: await options.integrationsRepository.listN8nWorkflows() };
    } catch (error) {
      if (error instanceof N8nUnavailableError) {
        return {
          workflows: [],
          message: error.message,
        };
      }
      throw error;
    }
  });

  app.patch('/api/automations/n8n-workflows/:id', { preHandler: automationManagePreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const payload = request.body && typeof request.body === 'object' ? request.body as { active?: unknown } : {};
      if (typeof payload.active !== 'boolean') return reply.code(400).send({ error: 'active boolean é obrigatório' });
      return { result: await options.integrationsRepository.setN8nWorkflowActive(id, payload.active) };
    } catch (error) {
      return handleIntegrationError(error, reply);
    }
  });

  app.post('/api/automations/:id/run', { preHandler: automationManagePreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const payload = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
      return { run: await options.integrationsRepository.runAutomation(contextFromRequest(request), id, payload) };
    } catch (error) {
      return handleIntegrationError(error, reply);
    }
  });

  app.get('/api/webhooks', { preHandler: webhooksPreHandler }, async (request) => {
    const context = contextFromRequest(request);
    return { webhooks: await options.integrationsRepository.listWebhooks(context.tenantId) };
  });

  app.get('/api/webhooks/deliveries', { preHandler: webhooksPreHandler }, async (request) => {
    const context = contextFromRequest(request);
    return { deliveries: await options.integrationsRepository.listWebhookDeliveries(context) };
  });

  app.post('/api/webhooks/:id/test', { preHandler: webhookTestPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return { result: await options.integrationsRepository.testWebhook(contextFromRequest(request), id) };
    } catch (error) {
      return handleIntegrationError(error, reply);
    }
  });
}
