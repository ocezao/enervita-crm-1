import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { PermissionKey } from '@enervita/shared';
import { hasPermission } from '../modules/permissions/permission.service.ts';
import { parseSessionCookie, verifySessionToken } from '../modules/auth/session.ts';
import { type PublicUser, type UserRepository, toPublicUser } from '../modules/auth/userRepository.ts';

export async function getAuthenticatedUser(
  request: FastifyRequest,
  userRepository: UserRepository,
  sessionSecret: string,
): Promise<PublicUser | null> {
  const cookieHeader = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
  const token = parseSessionCookie(cookieHeader);
  const session = verifySessionToken(token, sessionSecret);
  if (!session) return null;

  const revokedAt = await userRepository.getSessionRevokedAtEpoch?.(session.userId);
  if (revokedAt !== null && revokedAt !== undefined && session.iat <= revokedAt) return null;

  const user = await userRepository.findActiveUserById(session.userId);
  return user ? toPublicUser(user) : null;
}

export type AuthzOptions = {
  userRepository: UserRepository;
  sessionSecret: string;
};

async function authenticateOrReply(
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthzOptions,
): Promise<PublicUser | null> {
  const user = await getAuthenticatedUser(request, options.userRepository, options.sessionSecret);
  if (!user) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }

  (request as FastifyRequest & { authenticatedUser?: PublicUser }).authenticatedUser = user;
  return user;
}

export function requireAuth(options: AuthzOptions): preHandlerHookHandler {
  return async (request, reply) => {
    await authenticateOrReply(request, reply, options);
  };
}

export function requirePermission(permissionKey: PermissionKey, options: AuthzOptions): preHandlerHookHandler {
  return async (request, reply) => {
    const user = await authenticateOrReply(request, reply, options);
    if (!user) return;

    if (!hasPermission(user, permissionKey)) {
      reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
