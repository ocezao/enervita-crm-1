import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { LeadsNotFoundError, LeadsOperationError, type LeadsRepository } from './repository.ts';
import { bulkDeleteLeads, bulkSetLeadTags, changeLeadStage, createLead, deleteLead, getLead, listLeadHistory, listLeads, setLeadTags, updateLead } from './leads.service.ts';
import { validateBulkSetLeadTagsBody, validateCreateLeadBody, validateLeadIdsBody, validateListLeadsQuery, validateSetLeadTagsBody, validateStageChangeBody, validateUpdateLeadBody, validateUuid, ValidationError } from './validation.ts';

type LeadsRouteOptions = {
  userRepository: UserRepository;
  leadsRepository: LeadsRepository;
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

function handleLeadsError(error: unknown, reply: FastifyReply) {
  if (error instanceof ValidationError) return reply.code(400).send({ error: error.message });
  if (error instanceof LeadsNotFoundError) return reply.code(404).send({ error: 'Lead not found' });
  if (error instanceof LeadsOperationError) return reply.code(403).send({ error: error.message });
  throw error;
}

export async function registerLeadsRoutes(app: FastifyInstance, options: LeadsRouteOptions): Promise<void> {
  const viewPreHandler = requirePermission('lead.view', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const createPreHandler = requirePermission('lead.create', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const editPreHandler = requirePermission('lead.edit', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const stagePreHandler = requirePermission('lead.stage_change', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/leads', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const filters = validateListLeadsQuery(request.query);
      const leads = await listLeads(options.leadsRepository, authenticatedUser(request), filters);
      return { leads };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.get('/api/leads/:id/history', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      const history = await listLeadHistory(options.leadsRepository, authenticatedUser(request), id);
      return { history };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.get('/api/leads/:id', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      const lead = await getLead(options.leadsRepository, authenticatedUser(request), id);
      if (!lead) return reply.code(404).send({ error: 'Lead not found' });
      return { lead };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.post('/api/leads', { preHandler: createPreHandler }, async (request, reply) => {
    try {
      const input = validateCreateLeadBody(request.body);
      const lead = await createLead(options.leadsRepository, authenticatedUser(request), input, auditMetadata(request));
      return reply.code(201).send({ lead });
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.patch('/api/leads/:id', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      const input = validateUpdateLeadBody(request.body);
      const lead = await updateLead(options.leadsRepository, authenticatedUser(request), id, input, auditMetadata(request));
      return { lead };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.patch('/api/leads/:id/tags', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      const input = validateSetLeadTagsBody(request.body);
      const lead = await setLeadTags(options.leadsRepository, authenticatedUser(request), id, input, auditMetadata(request));
      return { lead };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.post('/api/leads/bulk/tags', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const input = validateBulkSetLeadTagsBody(request.body);
      const leads = await bulkSetLeadTags(options.leadsRepository, authenticatedUser(request), input, auditMetadata(request));
      return { leads };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.post('/api/leads/bulk/delete', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const input = validateLeadIdsBody(request.body);
      const result = await bulkDeleteLeads(options.leadsRepository, authenticatedUser(request), input, auditMetadata(request));
      return result;
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.delete('/api/leads/:id', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      await deleteLead(options.leadsRepository, authenticatedUser(request), id, auditMetadata(request));
      return { deleted: 1 };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });

  app.patch('/api/leads/:id/stage', { preHandler: stagePreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const id = validateUuid(rawId, "id");
      const input = validateStageChangeBody(request.body);
      const lead = await changeLeadStage(options.leadsRepository, authenticatedUser(request), id, input, auditMetadata(request));
      return { lead };
    } catch (error) {
      return handleLeadsError(error, reply);
    }
  });
}
