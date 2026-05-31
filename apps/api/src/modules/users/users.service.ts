import bcrypt from 'bcryptjs';
import { PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from '@enervita/shared';
import type { PublicUser } from '../auth/userRepository.ts';
import type { AdminUser, AuditContext, UsersRepository } from './repository.ts';
import { BCRYPT_ROUNDS } from './repository.ts';
import type { CreateUserInput, UpdateUserInput } from './validation.ts';

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

function withEffectiveAccess(user: AdminUser): AdminUser {
  if (!user.roles.includes('admin')) return user;
  return {
    ...user,
    permissions: [...PERMISSION_KEYS],
    allowedStages: [...PIPELINE_STAGE_KEYS],
  };
}

export async function listAdminUsers(repository: UsersRepository, actor: PublicUser) {
  const users = await repository.listUsers(actor.tenantId);
  return users.map(withEffectiveAccess);
}

export async function getAdminUser(repository: UsersRepository, actor: PublicUser, userId: string) {
  const user = await repository.getUser(actor.tenantId, userId);
  return user ? withEffectiveAccess(user) : null;
}

export async function createAdminUser(
  repository: UsersRepository,
  actor: PublicUser,
  input: CreateUserInput,
  metadata: RequestAuditMetadata,
) {
  const passwordHash = await bcrypt.hash(input.temporaryPassword, BCRYPT_ROUNDS);
  return withEffectiveAccess(await repository.createUser(makeAuditContext(actor, metadata), { ...input, passwordHash }));
}

export async function updateAdminUser(
  repository: UsersRepository,
  actor: PublicUser,
  userId: string,
  input: UpdateUserInput,
  metadata: RequestAuditMetadata,
) {
  return withEffectiveAccess(await repository.updateUser(makeAuditContext(actor, metadata), userId, input));
}

export async function resetAdminUserPassword(
  repository: UsersRepository,
  actor: PublicUser,
  userId: string,
  temporaryPassword: string,
  metadata: RequestAuditMetadata,
) {
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
  return withEffectiveAccess(await repository.resetPassword(makeAuditContext(actor, metadata), userId, passwordHash));
}
