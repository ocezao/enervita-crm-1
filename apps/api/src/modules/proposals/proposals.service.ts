import type { PublicUser } from '../auth/userRepository.ts';
import { isAdminUser } from '../auth/userRepository.ts';
import type { AuditContext } from '../users/repository.ts';
import type { ProposalsRepository } from './repository.ts';
import type { ProposalInput, UpdateProposalInput } from './validation.ts';

export function contextFromUser(user: PublicUser, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>): AuditContext {
  return { tenantId: user.tenantId, actorUserId: user.id, ...audit };
}

export async function listProposals(repository: ProposalsRepository, user: PublicUser) {
  return repository.listProposals(user.tenantId, isAdminUser(user) ? null : user.id);
}

export async function listProposalsForLead(repository: ProposalsRepository, user: PublicUser, leadId: string) {
  return repository.listProposalsForLead(user.tenantId, leadId, isAdminUser(user) ? null : user.id);
}

export async function createProposal(repository: ProposalsRepository, user: PublicUser, input: ProposalInput, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>) {
  return repository.createProposal(contextFromUser(user, audit), input, isAdminUser(user) ? null : user.id);
}

export async function listTrackingEventsForLead(repository: ProposalsRepository, user: PublicUser, leadId: string) {
  return repository.listTrackingEventsForLead(user.tenantId, leadId, { excludePlatforms: ['google_ads', 'ga4'], ownerUserId: isAdminUser(user) ? null : user.id });
}

export async function listTemplates(repository: ProposalsRepository, user: PublicUser) {
  return repository.listTemplates(user.tenantId);
}

export async function getProposal(repository: ProposalsRepository, user: PublicUser, proposalId: string) {
  return repository.getProposal(user.tenantId, proposalId);
}

export async function updateProposal(repository: ProposalsRepository, user: PublicUser, proposalId: string, input: UpdateProposalInput, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>) {
  return repository.updateProposal(contextFromUser(user, audit), proposalId, input);
}

export async function deleteProposal(repository: ProposalsRepository, user: PublicUser, proposalId: string, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>) {
  return repository.deleteProposal(contextFromUser(user, audit), proposalId);
}
