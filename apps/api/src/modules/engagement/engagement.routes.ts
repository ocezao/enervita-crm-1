import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { createActivity, createTask, completeTask, EngagementNotFoundError, listActivities, listTasks } from './engagement.service.ts';
import type { EngagementRepository } from './repository.ts';
import { EngagementValidationError, validateCreateActivityBody, validateCreateTaskBody, validateUuid } from './validation.ts';

type EngagementRouteOptions = {
  userRepository: UserRepository;
  engagementRepository: EngagementRepository;
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

function handleEngagementError(error: unknown, reply: FastifyReply) {
  if (error instanceof EngagementValidationError) return reply.code(400).send({ error: error.message });
  if (error instanceof EngagementNotFoundError) return reply.code(404).send({ error: error.message });
  throw error;
}

export async function registerEngagementRoutes(app: FastifyInstance, options: EngagementRouteOptions): Promise<void> {
  const tasksPagePreHandler = requirePermission('page.tasks', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const taskCreatePreHandler = requirePermission('task.create', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const taskCompletePreHandler = requirePermission('task.complete', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const leadViewPreHandler = requirePermission('lead.view', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const activityCreatePreHandler = requirePermission('activity.create', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/tasks', { preHandler: tasksPagePreHandler }, async (request, reply) => {
    try {
      const tasks = await listTasks(options.engagementRepository, authenticatedUser(request));
      return { tasks };
    } catch (error) {
      return handleEngagementError(error, reply);
    }
  });

  app.post('/api/tasks', { preHandler: taskCreatePreHandler }, async (request, reply) => {
    try {
      const input = validateCreateTaskBody(request.body);
      const task = await createTask(options.engagementRepository, authenticatedUser(request), input, auditMetadata(request));
      return reply.code(201).send({ task });
    } catch (error) {
      return handleEngagementError(error, reply);
    }
  });

  app.patch('/api/tasks/:id/complete', { preHandler: taskCompletePreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, 'id');
      const task = await completeTask(options.engagementRepository, authenticatedUser(request), id, auditMetadata(request));
      return { task };
    } catch (error) {
      return handleEngagementError(error, reply);
    }
  });

  app.get('/api/leads/:id/activities', { preHandler: leadViewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const leadId = validateUuid(rawId, 'id');
      const activities = await listActivities(options.engagementRepository, authenticatedUser(request), leadId);
      return { activities };
    } catch (error) {
      return handleEngagementError(error, reply);
    }
  });

  app.post('/api/leads/:id/activities', { preHandler: activityCreatePreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const leadId = validateUuid(rawId, 'id');
      const input = validateCreateActivityBody(leadId, request.body);
      const activity = await createActivity(options.engagementRepository, authenticatedUser(request), input, auditMetadata(request));
      return reply.code(201).send({ activity });
    } catch (error) {
      return handleEngagementError(error, reply);
    }
  });
}
