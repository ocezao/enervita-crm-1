import {
  PERMISSION_CATEGORIES,
  PERMISSION_DEFINITIONS,
  PERMISSION_KEYS,
  PIPELINE_STAGE_DEFINITIONS,
  PIPELINE_STAGE_KEYS,
  type PermissionKey,
  type PipelineStageKey,
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

export function isKnownPipelineStage(stage: string): stage is PipelineStageKey {
  return PIPELINE_STAGE_KEYS.includes(stage as PipelineStageKey);
}

export function canAccessStage(user: PublicUser, stage: PipelineStageKey): boolean {
  return isAdminUser(user) || getAllowedStages(user).includes(stage);
}

export function getStageScopeForUser(user: PublicUser): PipelineStageKey[] | null {
  if (isAdminUser(user)) return null;
  return getAllowedStages(user).filter(isKnownPipelineStage);
}

export function buildPermissionsCatalog() {
  return {
    categories: PERMISSION_CATEGORIES,
    permissions: PERMISSION_DEFINITIONS,
    stages: PIPELINE_STAGE_DEFINITIONS,
  };
}
