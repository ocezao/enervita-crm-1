import { getStageScopeForUser } from '../permissions/permission.service.ts';
import type { PublicUser } from '../auth/userRepository.ts';
import type { AuditContext } from '../users/repository.ts';
import type { EngagementRepository } from './repository.ts';
import type { ActivityInput, TaskInput } from './validation.ts';

export class EngagementNotFoundError extends Error {}

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

function scopedStages(actor: PublicUser) {
  return getStageScopeForUser(actor);
}

export async function listTasks(repository: EngagementRepository, actor: PublicUser) {
  return repository.listTasks(actor.tenantId, scopedStages(actor));
}

export async function createTask(repository: EngagementRepository, actor: PublicUser, input: TaskInput, metadata: RequestAuditMetadata) {
  const task = await repository.createTask(makeAuditContext(actor, metadata), input, scopedStages(actor));
  if (!task) throw new EngagementNotFoundError('Lead not found');
  return task;
}

export async function completeTask(repository: EngagementRepository, actor: PublicUser, taskId: string, metadata: RequestAuditMetadata) {
  const task = await repository.completeTask(makeAuditContext(actor, metadata), taskId, scopedStages(actor));
  if (!task) throw new EngagementNotFoundError('Task not found');
  return task;
}

export async function listActivities(repository: EngagementRepository, actor: PublicUser, leadId: string) {
  return repository.listActivities(actor.tenantId, leadId, scopedStages(actor));
}

export async function createActivity(repository: EngagementRepository, actor: PublicUser, input: ActivityInput, metadata: RequestAuditMetadata) {
  const activity = await repository.createActivity(makeAuditContext(actor, metadata), input, scopedStages(actor));
  if (!activity) throw new EngagementNotFoundError('Lead not found');
  return activity;
}
