import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PIPELINE_STAGE_KEYS, type PipelineStageKey } from '@enervita/shared';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { getDashboardMetrics } from './dashboard.service.ts';
import type { DashboardFilters, DashboardRepository } from './repository.ts';

type DashboardRouteOptions = {
  userRepository: UserRepository;
  dashboardRepository: DashboardRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

type DashboardQuery = {
  startDate?: string;
  endDate?: string;
  stage?: string;
  source?: string;
  platform?: string;
  activityType?: string;
};

const activityTypes = new Set(['note', 'call', 'email', 'whatsapp', 'meeting', 'stage_change']);

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function cleanFilter(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function buildFilters(query: DashboardQuery): DashboardFilters {
  const filters: DashboardFilters = {};
  const startDate = cleanFilter(query.startDate);
  const endDate = cleanFilter(query.endDate);
  const stage = cleanFilter(query.stage);
  const source = cleanFilter(query.source);
  const platform = cleanFilter(query.platform);
  const activityType = cleanFilter(query.activityType);

  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (stage && (PIPELINE_STAGE_KEYS as readonly string[]).includes(stage)) filters.stage = stage as PipelineStageKey;
  if (source) filters.source = source;
  if (platform) filters.platform = platform;
  if (activityType && activityTypes.has(activityType)) filters.activityType = activityType as DashboardFilters['activityType'];
  return filters;
}

export async function registerDashboardRoutes(app: FastifyInstance, options: DashboardRouteOptions): Promise<void> {
  const dashboardPreHandler = requirePermission('page.dashboard', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get<{ Querystring: DashboardQuery }>('/api/dashboard', { preHandler: dashboardPreHandler }, async (request) => {
    const metrics = await getDashboardMetrics(options.dashboardRepository, authenticatedUser(request), buildFilters(request.query));
    return { metrics };
  });
}
