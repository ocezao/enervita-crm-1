import type { FastifyReply } from 'fastify';

export class ProfileValidationError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProfileValidationError('Body must be an object');
  return value as Record<string, unknown>;
}

function normalizeEmail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ProfileValidationError('email must be valid');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new ProfileValidationError('email must be valid');
  return email;
}

function normalizeName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ProfileValidationError('name must be between 2 and 120 characters');
  const name = value.trim();
  if (name.length < 2 || name.length > 120) throw new ProfileValidationError('name must be between 2 and 120 characters');
  return name;
}

function normalizeAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new ProfileValidationError('avatarUrl must be a URL');
  const avatarUrl = value.trim();
  if (avatarUrl.length > 1_000) throw new ProfileValidationError('avatarUrl is too long');
  if (avatarUrl.startsWith('/uploads/avatars/')) return avatarUrl;
  try {
    const url = new URL(avatarUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol');
    return avatarUrl;
  } catch {
    throw new ProfileValidationError('avatarUrl must be a URL');
  }
}

export function validateOwnProfileBody(value: unknown): { name?: string; email?: string; avatarUrl?: string | null } {
  const body = asObject(value);
  const input = {
    name: normalizeName(body.name),
    email: normalizeEmail(body.email),
    avatarUrl: normalizeAvatarUrl(body.avatarUrl),
  };
  const compact = Object.fromEntries(Object.entries(input).filter(([, field]) => field !== undefined)) as { name?: string; email?: string; avatarUrl?: string | null };
  if (Object.keys(compact).length === 0) throw new ProfileValidationError('No changes provided');
  return compact;
}

export function validateOwnPasswordBody(value: unknown): { currentPassword: string; newPassword: string } {
  const body = asObject(value);
  if (typeof body.currentPassword !== 'string' || !body.currentPassword) throw new ProfileValidationError('currentPassword is required');
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) throw new ProfileValidationError('newPassword must be at least 8 characters');
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}

export function handleProfileValidationError(error: unknown, reply: FastifyReply) {
  if (error instanceof ProfileValidationError) return reply.code(400).send({ error: error.message });
  throw error;
}
