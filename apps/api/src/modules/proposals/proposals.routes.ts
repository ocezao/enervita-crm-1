import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import { isAdminUser } from '../auth/userRepository.ts';
import type { ProposalsRepository } from './repository.ts';
import { createProposal, deleteProposal, getProposal, listProposals, listProposalsForLead, listTemplates, listTrackingEventsForLead, updateProposal } from './proposals.service.ts';
import { ProposalValidationError, validateCreateProposalBody, validateUpdateProposalBody, validateUuid } from './validation.ts';

type ProposalsRouteOptions = {
  userRepository: UserRepository;
  proposalsRepository: ProposalsRepository;
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

function handleError(error: unknown, reply: FastifyReply) {
  if (error instanceof ProposalValidationError) return reply.code(400).send({ error: error.message });
  throw error;
}

export async function registerProposalsRoutes(app: FastifyInstance, options: ProposalsRouteOptions): Promise<void> {
  const viewPreHandler = requirePermission('proposal.view', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const createPreHandler = requirePermission('proposal.create', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const trackingPreHandler = requirePermission('tracking.view', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/proposals', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const proposals = await listProposals(options.proposalsRepository, authenticatedUser(request));
      return { proposals };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get('/api/proposals/templates', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const templates = await listTemplates(options.proposalsRepository, authenticatedUser(request));
      return { proposals: templates };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get('/api/proposals/:id', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const proposalId = validateUuid(rawId, 'id');
      const proposal = await getProposal(options.proposalsRepository, authenticatedUser(request), proposalId);
      if (!proposal) return reply.code(404).send({ error: 'Proposta não encontrada' });
      return { proposal };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.put('/api/proposals/:id', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const proposalId = validateUuid(rawId, 'id');
      const input = validateUpdateProposalBody(request.body);
      const proposal = await updateProposal(options.proposalsRepository, authenticatedUser(request), proposalId, input, auditMetadata(request));
      return { proposal };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.delete('/api/proposals/:id', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const user = authenticatedUser(request);
      if (!isAdminUser(user)) return reply.code(403).send({ error: 'Somente administradores podem excluir propostas' });
      const { id: rawId } = request.params as { id: string };
      const proposalId = validateUuid(rawId, 'id');
      await deleteProposal(options.proposalsRepository, user, proposalId, auditMetadata(request));
      return { deleted: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get('/api/leads/:id/proposals', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const leadId = validateUuid(rawId, 'id');
      const proposals = await listProposalsForLead(options.proposalsRepository, authenticatedUser(request), leadId);
      return { proposals };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.post('/api/proposals', { preHandler: createPreHandler }, async (request, reply) => {
    try {
      const input = validateCreateProposalBody(request.body);
      const proposal = await createProposal(options.proposalsRepository, authenticatedUser(request), input, auditMetadata(request));
      return reply.code(201).send({ proposal });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get('/api/leads/:id/tracking-events', { preHandler: trackingPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const leadId = validateUuid(rawId, 'id');
      const events = await listTrackingEventsForLead(options.proposalsRepository, authenticatedUser(request), leadId);
      return { events };
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
