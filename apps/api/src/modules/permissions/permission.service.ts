import {
  PERMISSION_CATEGORIES,
  PERMISSION_DEFINITIONS,
  PERMISSION_KEYS,
  PIPELINE_STAGE_DEFINITIONS,
  PIPELINE_STAGE_KEYS,
  type PermissionKey,
} from '@enervita/shared';
import { isAdminUser, type PublicUser } from '../auth/userRepository.ts';

export function getEffectivePermissions(user: PublicUser): string[] {
  if (isAdminUser(user)) return [...PERMISSION_KEYS];
  return [...new Set(user.permissions)];
}

export function getAllowedStages(user: PublicUser): string[] {
  if (isAdminUser(user)) return [...PIPELINE_STAGE_KEYS];
  return [...new Set(user.allowedStages)];
}

export function hasPermission(user: PublicUser, permissionKey: PermissionKey): boolean {
  return isAdminUser(user) || getEffectivePermissions(user).includes(permissionKey);
}

export function buildPermissionsCatalog() {
  return {
    categories: PERMISSION_CATEGORIES,
    permissions: PERMISSION_DEFINITIONS,
    stages: PIPELINE_STAGE_DEFINITIONS,
  };
}
