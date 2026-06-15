import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { InsightsRepository } from './insights.repository.ts';

type InsightsRouteOptions = {
  userRepository: UserRepository;
  insightsRepository: InsightsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) {
    throw new Error('Authenticated user missing after preHandler');
  }
  return user;
}

export async function registerInsightsRoutes(app: FastifyInstance, options: InsightsRouteOptions): Promise<void> {
  const insightsPreHandler = requirePermission('page.analytics', {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  app.get('/api/analytics/insights', { preHandler: insightsPreHandler }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const daysValue = Number(query.days);
    const validDays = Number.isFinite(daysValue) ? Math.max(7, Math.min(365, daysValue)) : 30;

    const actor = authenticatedUser(request);

    return {
      insights: await options.insightsRepository.getInsights(actor.tenantId, validDays),
    };
  });
}
