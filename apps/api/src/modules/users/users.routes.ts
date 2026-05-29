import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import {
  UsersConflictError,
  UsersNotFoundError,
  UsersOperationError,
  type UsersRepository,
} from './repository.ts';
import {
  createAdminUser,
  getAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from './users.service.ts';
import {
  validateCreateUserBody,
  validateResetPasswordBody,
  validateUpdateUserBody,
  ValidationError,
} from './validation.ts';

type UsersRouteOptions = {
  userRepository: UserRepository;
  usersRepository: UsersRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function auditMetadata(request: FastifyRequest) {
  return {
    ipAddress: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  };
}

function handleUsersError(error: unknown, reply: FastifyReply) {
  if (error instanceof ValidationError) return reply.code(400).send({ error: error.message });
  if (error instanceof UsersNotFoundError) return reply.code(404).send({ error: 'User not found' });
  if (error instanceof UsersConflictError) return reply.code(409).send({ error: error.message });
  if (error instanceof UsersOperationError) return reply.code(400).send({ error: error.message });
  throw error;
}

export async function registerUsersRoutes(app: FastifyInstance, options: UsersRouteOptions): Promise<void> {
  const preHandler = requirePermission('user.manage', {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  app.get('/api/users', { preHandler }, async (request, reply) => {
    try {
      const users = await listAdminUsers(options.usersRepository, authenticatedUser(request));
      return { users };
    } catch (error) {
      return handleUsersError(error, reply);
    }
  });

  app.post('/api/users', { preHandler }, async (request, reply) => {
    try {
      const input = validateCreateUserBody(request.body);
      const user = await createAdminUser(options.usersRepository, authenticatedUser(request), input, auditMetadata(request));
      return reply.code(201).send({ user });
    } catch (error) {
      return handleUsersError(error, reply);
    }
  });

  app.get('/api/users/:id', { preHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await getAdminUser(options.usersRepository, authenticatedUser(request), id);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return { user };
    } catch (error) {
      return handleUsersError(error, reply);
    }
  });

  app.patch('/api/users/:id', { preHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = validateUpdateUserBody(request.body);
      const user = await updateAdminUser(options.usersRepository, authenticatedUser(request), id, input, auditMetadata(request));
      return { user };
    } catch (error) {
      return handleUsersError(error, reply);
    }
  });

  app.post('/api/users/:id/reset-password', { preHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = validateResetPasswordBody(request.body);
      const user = await resetAdminUserPassword(
        options.usersRepository,
        authenticatedUser(request),
        id,
        input.temporaryPassword,
        auditMetadata(request),
      );
      return { user };
    } catch (error) {
      return handleUsersError(error, reply);
    }
  });
}
