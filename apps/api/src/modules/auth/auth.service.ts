import bcrypt from 'bcryptjs';
import { type AvatarFileInput } from './avatarUpload.ts';
import { type PublicUser, type UserRepository, toPublicUser } from './userRepository.ts';

export const INVALID_CREDENTIALS_ERROR = 'Invalid email or password';

const DUMMY_PASSWORD_HASH = '$2b$12$1oDaKY6fuFD6FSSYOdean.QzP9gg/Dw6aiCKxuzGkNUtzSOInjLrC';
const BCRYPT_ROUNDS = 12;

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

export async function updateOwnProfile(
  userRepository: UserRepository,
  userId: string,
  input: { name?: string; email?: string; avatarUrl?: string | null },
): Promise<PublicUser | null> {
  if (!userRepository.updateOwnProfile) return null;
  const user = await userRepository.updateOwnProfile(userId, input);
  return user ? toPublicUser(user) : null;
}

export async function uploadOwnAvatar(
  userRepository: UserRepository,
  userId: string,
  input: AvatarFileInput,
): Promise<PublicUser | null> {
  if (!userRepository.saveOwnAvatar) return null;
  const user = await userRepository.saveOwnAvatar(userId, input);
  return user ? toPublicUser(user) : null;
}

export async function changeOwnPassword(
  userRepository: UserRepository,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; statusCode: 400 | 401; error: string }> {
  if (newPassword.length < 8) return { ok: false, statusCode: 400, error: 'newPassword must be at least 8 characters' };
  const user = await userRepository.findActiveUserById(userId);
  if (!user) return { ok: false, statusCode: 401, error: 'Authentication required' };
  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) return { ok: false, statusCode: 401, error: INVALID_CREDENTIALS_ERROR };
  const updatePassword = userRepository.updateOwnPassword;
  if (!updatePassword) return { ok: false, statusCode: 400, error: 'Password update is not available' };
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, passwordHash);
  return { ok: true };
}
