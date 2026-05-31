import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { getStageScopeForUser } from '../permissions/permission.service.ts';
import type { AnalyticsFilters, AnalyticsRepository } from './repository.ts';

type AnalyticsRouteOptions = {
  userRepository: UserRepository;
  analyticsRepository: AnalyticsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function cleanQueryValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed !== 'all' ? trimmed : undefined;
}

export async function registerAnalyticsRoutes(app: FastifyInstance, options: AnalyticsRouteOptions): Promise<void> {
  const analyticsPreHandler = requirePermission('page.analytics', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/analytics/overview', { preHandler: analyticsPreHandler }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const rawDays = Number(query.days ?? '30');
    const filters: AnalyticsFilters = {
      days: Number.isFinite(rawDays) ? rawDays : 30,
      period: cleanQueryValue(query.period),
      startDate: cleanQueryValue(query.startDate),
      endDate: cleanQueryValue(query.endDate),
      source: cleanQueryValue(query.source),
      campaign: cleanQueryValue(query.campaign),
      stage: cleanQueryValue(query.stage) as AnalyticsFilters['stage'],
    };
    const actor = authenticatedUser(request);
    return { overview: await options.analyticsRepository.getOverview(actor.tenantId, getStageScopeForUser(actor), filters) };
  });
}
