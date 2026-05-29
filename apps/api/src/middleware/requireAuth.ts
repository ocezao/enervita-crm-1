import type { FastifyRequest } from 'fastify';
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

  const user = await userRepository.findActiveUserById(session.userId);
  return user ? toPublicUser(user) : null;
}
