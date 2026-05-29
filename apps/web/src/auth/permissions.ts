import type { AuthUser } from './authTypes';

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || (user.roles ?? []).includes('admin');
}

export function userHasPermission(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return isAdminUser(user) || (user.permissions ?? []).includes(permission);
}

export function userHasAnyPermission(user: AuthUser | null | undefined, permissions: string[]): boolean {
  return permissions.some((permission) => userHasPermission(user, permission));
}
