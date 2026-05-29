import bcrypt from 'bcryptjs';
import { type PublicUser, type UserRepository, toPublicUser } from './userRepository.ts';

export const INVALID_CREDENTIALS_ERROR = 'Invalid email or password';

const DUMMY_PASSWORD_HASH = '$2b$12$1oDaKY6fuFD6FSSYOdean.QzP9gg/Dw6aiCKxuzGkNUtzSOInjLrC';

export type LoginResult =
  | { ok: true; user: PublicUser; userId: string }
  | { ok: false; error: typeof INVALID_CREDENTIALS_ERROR };

export async function loginWithPassword(
  userRepository: UserRepository,
  email: string,
  password: string,
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, error: INVALID_CREDENTIALS_ERROR };
  }

  const user = await userRepository.findActiveUserByEmail(normalizedEmail);
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!user || !passwordMatches) return { ok: false, error: INVALID_CREDENTIALS_ERROR };

  await userRepository.recordLogin(user.id);
  return { ok: true, user: toPublicUser(user), userId: user.id };
}
