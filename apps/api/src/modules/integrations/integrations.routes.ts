import type { FastifyInstance, FastifyReply } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { UserRepository } from '../auth/userRepository.ts';
import { IntegrationNotFoundError, listAutomations, listWebhooks, testWebhook } from './integrations.service.ts';

type IntegrationsRouteOptions = {
  userRepository: UserRepository;
  sessionSecret: string;
};

function handleIntegrationError(error: unknown, reply: FastifyReply) {
  if (error instanceof IntegrationNotFoundError) return reply.code(404).send({ error: error.message });
  throw error;
}

export async function registerIntegrationsRoutes(app: FastifyInstance, options: IntegrationsRouteOptions): Promise<void> {
  const automationsPreHandler = requirePermission('page.automations', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const webhooksPreHandler = requirePermission('page.webhooks', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const webhookTestPreHandler = requirePermission('webhook.test', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/automations', { preHandler: automationsPreHandler }, async () => ({ automations: listAutomations() }));

  app.get('/api/webhooks', { preHandler: webhooksPreHandler }, async () => ({ webhooks: listWebhooks() }));

  app.post('/api/webhooks/:id/test', { preHandler: webhookTestPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return { result: testWebhook(id) };
    } catch (error) {
      return handleIntegrationError(error, reply);
    }
  });
}
