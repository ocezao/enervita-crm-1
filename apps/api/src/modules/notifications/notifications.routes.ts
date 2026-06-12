import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { NotificationsRepository } from './repository.ts';

type Options = {
  userRepository: UserRepository;
  notificationsRepository: NotificationsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function parseLimit(value: unknown) {
  const raw = typeof value === 'string' ? Number(value) : 20;
  return Number.isFinite(raw) ? Math.max(1, Math.min(raw, 50)) : 20;
}

export async function registerNotificationsRoutes(app: FastifyInstance, options: Options): Promise<void> {
  const preHandler = requireAuth({ userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/notifications', { preHandler }, async (request) => {
    const user = authenticatedUser(request);
    const query = request.query as { limit?: string };
    return options.notificationsRepository.listForUser(user.tenantId, user.id, parseLimit(query?.limit));
  });

  app.post('/api/notifications/:id/read', { preHandler }, async (request, reply: FastifyReply) => {
    const user = authenticatedUser(request);
    const { id } = request.params as { id: string };
    const notification = await options.notificationsRepository.markAsRead(user.tenantId, user.id, id);
    if (!notification) return reply.code(404).send({ error: 'Notification not found' });
    return { notification };
  });

  app.post('/api/notifications/read-all', { preHandler }, async (request) => {
    const user = authenticatedUser(request);
    const count = await options.notificationsRepository.markAllAsRead(user.tenantId, user.id);
    return { count };
  });
}
