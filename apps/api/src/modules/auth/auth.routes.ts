import type { FastifyInstance } from 'fastify';
import { getAuthenticatedUser, requireAuth } from '../../middleware/requireAuth.ts';
import { buildPermissionsCatalog } from '../permissions/permission.service.ts';
import { changeOwnPassword, loginWithPassword, updateOwnProfile, uploadOwnAvatar } from './auth.service.ts';
import { handleAvatarUploadError, parseAvatarUpload, sendLocalAvatarFile } from './avatarUpload.ts';
import { handleProfileValidationError, validateOwnPasswordBody, validateOwnProfileBody } from './profile.validation.ts';
import { createSessionToken, serializeClearSessionCookie, serializeSessionCookie } from './session.ts';
import type { UserRepository } from './userRepository.ts';

type AuthRouteOptions = {
  userRepository: UserRepository;
  sessionSecret: string;
  secureCookies: boolean;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

const failedLogins = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_MAX_KEYS = 5_000;

function rateLimitKey(email: string, ip: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}

function pruneExpiredFailedLogins(): void {
  const now = Date.now();
  for (const [key, entry] of failedLogins) {
    if (entry.resetAt <= now) failedLogins.delete(key);
  }

  while (failedLogins.size > RATE_LIMIT_MAX_KEYS) {
    const oldestKey = failedLogins.keys().next().value as string | undefined;
    if (!oldestKey) break;
    failedLogins.delete(oldestKey);
  }
}

function isRateLimited(key: string): boolean {
  pruneExpiredFailedLogins();
  const entry = failedLogins.get(key);
  return entry ? entry.count >= RATE_LIMIT_MAX_ATTEMPTS : false;
}

function recordFailedLogin(key: string): void {
  pruneExpiredFailedLogins();
  const now = Date.now();
  const existing = failedLogins.get(key);
  if (!existing || existing.resetAt <= now) {
    failedLogins.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  existing.count += 1;
}

function clearFailedLogin(key: string): void {
  failedLogins.delete(key);
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as LoginBody | undefined;
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const key = rateLimitKey(email, request.ip);

    if (isRateLimited(key)) {
      return reply.code(429).send({ error: 'Too many login attempts' });
    }

    const result = await loginWithPassword(options.userRepository, email, password);
    if (!result.ok) {
      recordFailedLogin(key);
      return reply.code(401).send({ error: result.error });
    }

    clearFailedLogin(key);
    const token = createSessionToken(result.userId, options.sessionSecret);
    reply.header('set-cookie', serializeSessionCookie(token, options.secureCookies));
    return { user: result.user };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
    if (user) await options.userRepository.revokeSessions?.(user.id);
    reply.header('set-cookie', serializeClearSessionCookie(options.secureCookies));
    return { ok: true };
  });

  app.get('/api/me', async (request, reply) => {
    const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    return { user };
  });

  app.patch('/api/me', async (request, reply) => {
    const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    try {
      const input = validateOwnProfileBody(request.body);
      const updatedUser = await updateOwnProfile(options.userRepository, user.id, input);
      if (!updatedUser) return reply.code(401).send({ error: 'Authentication required' });
      return { user: updatedUser };
    } catch (error) {
      return handleProfileValidationError(error, reply);
    }
  });

  app.post('/api/me/password', async (request, reply) => {
    const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    try {
      const input = validateOwnPasswordBody(request.body);
      const result = await changeOwnPassword(options.userRepository, user.id, input.currentPassword, input.newPassword);
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return { ok: true };
    } catch (error) {
      return handleProfileValidationError(error, reply);
    }
  });

  app.post('/api/me/avatar', { bodyLimit: 5 * 1024 * 1024 + 16_384 }, async (request, reply) => {
    const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    try {
      const avatar = parseAvatarUpload(request.headers['content-type'], request.body);
      const updatedUser = await uploadOwnAvatar(options.userRepository, user.id, avatar);
      if (!updatedUser) return reply.code(401).send({ error: 'Authentication required' });
      return { user: updatedUser };
    } catch (error) {
      return handleAvatarUploadError(error, reply);
    }
  });

  app.get('/uploads/avatars/:fileName', sendLocalAvatarFile);

  app.get(
    '/api/permissions/catalog',
    { preHandler: requireAuth({ userRepository: options.userRepository, sessionSecret: options.sessionSecret }) },
    async () => buildPermissionsCatalog(),
  );
}
