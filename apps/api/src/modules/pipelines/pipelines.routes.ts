import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import { isAdminUser, type PublicUser, type UserRepository } from '../auth/userRepository.ts';
import type { PipelinesRepository } from './repository.ts';

type PipelinesRouteOptions = {
  userRepository: UserRepository;
  pipelinesRepository: PipelinesRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

export async function registerPipelinesRoutes(app: FastifyInstance, options: PipelinesRouteOptions): Promise<void> {
  const preHandler = requirePermission('lead.view', {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  app.get('/api/pipelines', { preHandler }, async (request) => {
    const user = authenticatedUser(request);
    const pipelines = await options.pipelinesRepository.listPipelines(user.tenantId, user.id, isAdminUser(user));
    return { pipelines };
  });
}
