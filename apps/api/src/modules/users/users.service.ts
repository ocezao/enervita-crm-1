import bcrypt from 'bcryptjs';
import type { PublicUser } from '../auth/userRepository.ts';
import type { AuditContext, UsersRepository } from './repository.ts';
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

export async function listAdminUsers(repository: UsersRepository, actor: PublicUser) {
  return repository.listUsers(actor.tenantId);
}

export async function getAdminUser(repository: UsersRepository, actor: PublicUser, userId: string) {
  return repository.getUser(actor.tenantId, userId);
}

export async function createAdminUser(
  repository: UsersRepository,
  actor: PublicUser,
  input: CreateUserInput,
  metadata: RequestAuditMetadata,
) {
  const passwordHash = await bcrypt.hash(input.temporaryPassword, BCRYPT_ROUNDS);
  return repository.createUser(makeAuditContext(actor, metadata), { ...input, passwordHash });
}

export async function updateAdminUser(
  repository: UsersRepository,
  actor: PublicUser,
  userId: string,
  input: UpdateUserInput,
  metadata: RequestAuditMetadata,
) {
  return repository.updateUser(makeAuditContext(actor, metadata), userId, input);
}

export async function resetAdminUserPassword(
  repository: UsersRepository,
  actor: PublicUser,
  userId: string,
  temporaryPassword: string,
  metadata: RequestAuditMetadata,
) {
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
  return repository.resetPassword(makeAuditContext(actor, metadata), userId, passwordHash);
}
