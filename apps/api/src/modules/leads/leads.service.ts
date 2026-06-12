import { type PipelineStageKey } from '@enervita/shared';
import { canAccessStage, getStageScopeForUser, hasPermission, isKnownPipelineStage } from '../permissions/permission.service.ts';
import { isAdminUser, type PublicUser } from '../auth/userRepository.ts';
import type { AuditContext } from '../users/repository.ts';
import type { LeadsRepository } from './repository.ts';
import { LeadsOperationError } from './repository.ts';
import type { BulkSetLeadTagsInput, CreateLeadInput, LeadIdsInput, LeadListFilters, SetLeadTagsInput, StageChangeInput, UpdateLeadInput } from './validation.ts';

export type RequestAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

function makeAuditContext(actor: PublicUser, metadata: RequestAuditMetadata): AuditContext {
  return {
    actorUserId: actor.id,
    tenantId: actor.tenantId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  };
}

function scopedStages(actor: PublicUser): PipelineStageKey[] | null {
  return getStageScopeForUser(actor);
}

function scopedOwner(actor: PublicUser): string | null {
  return isAdminUser(actor) ? null : actor.id;
}

function ensureStageAllowed(actor: PublicUser, stage: PipelineStageKey): void {
  if (!canAccessStage(actor, stage)) throw new LeadsOperationError('Pipeline stage is not allowed for this user');
}

function ensureMarkLostAllowed(actor: PublicUser, stage: PipelineStageKey): void {
  if (stage === 'perdido' && !hasPermission(actor, 'lead.mark_lost')) {
    throw new LeadsOperationError('lead.mark_lost permission is required to mark a lead as lost');
  }
}

export async function listLeads(repository: LeadsRepository, actor: PublicUser, filters?: LeadListFilters) {
  return repository.listLeads(actor.tenantId, scopedStages(actor), scopedOwner(actor), filters);
}

export async function getLead(repository: LeadsRepository, actor: PublicUser, leadId: string) {
  return repository.getLead(actor.tenantId, leadId, scopedStages(actor), scopedOwner(actor));
}

export async function listLeadHistory(repository: LeadsRepository, actor: PublicUser, leadId: string) {
  return repository.listLeadHistory(actor.tenantId, leadId, scopedStages(actor), scopedOwner(actor));
}

export async function createLead(repository: LeadsRepository, actor: PublicUser, input: CreateLeadInput, metadata: RequestAuditMetadata) {
  ensureStageAllowed(actor, input.stage);
  ensureMarkLostAllowed(actor, input.stage);
  if (!isAdminUser(actor)) {
    if (input.sdrOwnerId && input.sdrOwnerId !== actor.id) throw new LeadsOperationError('Lead owner is not allowed for this user');
    return repository.createLead(makeAuditContext(actor, metadata), { ...input, sdrOwnerId: actor.id });
  }
  return repository.createLead(makeAuditContext(actor, metadata), input);
}

export async function updateLead(repository: LeadsRepository, actor: PublicUser, leadId: string, input: UpdateLeadInput, metadata: RequestAuditMetadata) {
  if (!isAdminUser(actor) && input.sdrOwnerId !== undefined && input.sdrOwnerId !== actor.id) throw new LeadsOperationError('Lead owner is not allowed for this user');
  return repository.updateLead(makeAuditContext(actor, metadata), leadId, scopedStages(actor), scopedOwner(actor), input);
}

export async function changeLeadStage(repository: LeadsRepository, actor: PublicUser, leadId: string, input: StageChangeInput, metadata: RequestAuditMetadata) {
  if (!isKnownPipelineStage(input.stage)) throw new LeadsOperationError('Unknown pipeline stage');
  ensureStageAllowed(actor, input.stage);
  ensureMarkLostAllowed(actor, input.stage);
  return repository.changeStage(makeAuditContext(actor, metadata), leadId, scopedStages(actor), scopedOwner(actor), input.stage, input.notes, input.lostReason, input.createOpportunity);
}


export async function setLeadTags(repository: LeadsRepository, actor: PublicUser, leadId: string, input: SetLeadTagsInput, metadata: RequestAuditMetadata) {
  return repository.setLeadTags(makeAuditContext(actor, metadata), leadId, scopedStages(actor), scopedOwner(actor), input);
}

export async function bulkSetLeadTags(repository: LeadsRepository, actor: PublicUser, input: BulkSetLeadTagsInput, metadata: RequestAuditMetadata) {
  return repository.bulkSetLeadTags(makeAuditContext(actor, metadata), input.leadIds, scopedStages(actor), scopedOwner(actor), { tags: input.tags });
}

export async function deleteLead(repository: LeadsRepository, actor: PublicUser, leadId: string, metadata: RequestAuditMetadata) {
  return repository.deleteLead(makeAuditContext(actor, metadata), leadId, scopedStages(actor), scopedOwner(actor));
}

export async function bulkDeleteLeads(repository: LeadsRepository, actor: PublicUser, input: LeadIdsInput, metadata: RequestAuditMetadata) {
  return repository.bulkDeleteLeads(makeAuditContext(actor, metadata), input.leadIds, scopedStages(actor), scopedOwner(actor));
}
