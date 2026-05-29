import type { PublicUser } from '../auth/userRepository.ts';
import type { AuditContext } from '../users/repository.ts';
import type { ProposalsRepository } from './repository.ts';
import type { ProposalInput } from './validation.ts';

export function contextFromUser(user: PublicUser, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>): AuditContext {
  return { tenantId: user.tenantId, actorUserId: user.id, ...audit };
}

export async function listProposals(repository: ProposalsRepository, user: PublicUser) {
  return repository.listProposals(user.tenantId);
}

export async function listProposalsForLead(repository: ProposalsRepository, user: PublicUser, leadId: string) {
  return repository.listProposalsForLead(user.tenantId, leadId);
}

export async function createProposal(repository: ProposalsRepository, user: PublicUser, input: ProposalInput, audit: Omit<AuditContext, 'tenantId' | 'actorUserId'>) {
  return repository.createProposal(contextFromUser(user, audit), input);
}

export async function listTrackingEventsForLead(repository: ProposalsRepository, user: PublicUser, leadId: string) {
  return repository.listTrackingEventsForLead(user.tenantId, leadId, { excludePlatforms: ['google_ads', 'ga4'] });
}
