import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { AiConfig } from '../../config/env.ts';
import { answerAiChat, type AiSqlRunner } from './ai.service.ts';

type AiRouteOptions = {
  userRepository: UserRepository;
  sessionSecret: string;
  aiConfig: AiConfig;
  sqlRunner: AiSqlRunner;
  fetchImpl?: typeof fetch;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

const ChatBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

export async function registerAiRoutes(app: FastifyInstance, options: AiRouteOptions): Promise<void> {
  const preHandler = requirePermission('page.ai_assistant', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.post('/api/ai/chat', { preHandler }, async (request, reply) => {
    const parsed = ChatBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_AI_MESSAGE' });
    }

    const user = authenticatedUser(request);
    if (!options.aiConfig.apiKey) {
      return reply.status(503).send({
        error: 'LLM_NOT_CONFIGURED',
        provider: options.aiConfig.provider,
        model: options.aiConfig.model,
      });
    }

    try {
      const result = await answerAiChat({ config: options.aiConfig, sqlRunner: options.sqlRunner, fetchImpl: options.fetchImpl }, user, parsed.data.message);
      return {
        answer: result.answer,
        provider: options.aiConfig.provider,
        model: options.aiConfig.model,
        sqlQueries: result.sqlQueries,
      };
    } catch {
      return reply.status(502).send({ error: 'LLM_REQUEST_FAILED' });
    }
  });
}
