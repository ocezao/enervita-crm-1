import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { getDashboardMetrics } from './dashboard.service.ts';
import type { DashboardRepository } from './repository.ts';

type DashboardRouteOptions = {
  userRepository: UserRepository;
  dashboardRepository: DashboardRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

export async function registerDashboardRoutes(app: FastifyInstance, options: DashboardRouteOptions): Promise<void> {
  const dashboardPreHandler = requirePermission('page.dashboard', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/dashboard', { preHandler: dashboardPreHandler }, async (request) => {
    const metrics = await getDashboardMetrics(options.dashboardRepository, authenticatedUser(request));
    return { metrics };
  });
}
