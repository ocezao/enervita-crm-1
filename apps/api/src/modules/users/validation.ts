import {
  PERMISSION_KEYS,
  PIPELINE_STAGE_KEYS,
  type PermissionKey,
  type PipelineStageKey,
} from '@enervita/shared';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const permissionSet = new Set<string>(PERMISSION_KEYS);
const stageSet = new Set<string>(PIPELINE_STAGE_KEYS);
const PASSWORD_MIN_LENGTH = 8;

export type EmployeeProfileInput = {
  employeeCode?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  managerUserId?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  isActive?: boolean;
};

export type CreateUserInput = {
  name: string;
  email: string;
  temporaryPassword: string;
  status: 'active' | 'inactive';
  roles: string[];
  permissions: PermissionKey[];
  allowedStages: PipelineStageKey[];
  profile: EmployeeProfileInput;
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  status?: 'active' | 'inactive';
  roles?: string[];
  permissions?: PermissionKey[];
  allowedStages?: PipelineStageKey[];
  profile?: EmployeeProfileInput;
};

export type ResetPasswordInput = { temporaryPassword: string };

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Body must be an object');
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, field: string, max = 160): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`${field} is too long`);
  return trimmed || null;
}

function requiredString(body: Record<string, unknown>, field: string, min: number, max: number): string {
  const value = body[field];
  if (typeof value !== 'string') throw new ValidationError(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max} characters`);
  }
  return trimmed;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('email is required');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('email must be valid');
  return email;
}

function parseStatus(value: unknown, defaultStatus?: 'active' | 'inactive'): 'active' | 'inactive' {
  if (value === undefined) {
    if (defaultStatus) return defaultStatus;
    throw new ValidationError('status is required');
  }
  if (value === 'active' || value === 'inactive') return value;
  throw new ValidationError('status must be active or inactive');
}

function parsePassword(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('temporaryPassword is required');
  if (value.length < PASSWORD_MIN_LENGTH) throw new ValidationError(`temporaryPassword must be at least ${PASSWORD_MIN_LENGTH} characters`);
  return value;
}

function parseStringArray(value: unknown, field: string, defaultValue: string[] = []): string[] {
  if (value === undefined) return defaultValue;
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  return [...new Set(value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) throw new ValidationError(`${field} must contain only strings`);
    return item.trim();
  }))];
}

function parsePermissions(value: unknown, required: boolean): PermissionKey[] | undefined {
  if (value === undefined && !required) return undefined;
  const keys = parseStringArray(value, 'permissions');
  for (const key of keys) {
    if (!permissionSet.has(key)) throw new ValidationError(`Invalid permission: ${key}`);
  }
  return keys as PermissionKey[];
}

function parseStages(value: unknown, required: boolean): PipelineStageKey[] | undefined {
  if (value === undefined && !required) return undefined;
  const keys = parseStringArray(value, 'allowedStages');
  for (const key of keys) {
    if (!stageSet.has(key)) throw new ValidationError(`Invalid stage: ${key}`);
  }
  return keys as PipelineStageKey[];
}

function parseProfile(value: unknown, required = false): EmployeeProfileInput | undefined {
  if (value === undefined) return required ? {} : undefined;
  const body = asObject(value);
  const profile: EmployeeProfileInput = {};
  const employeeCode = optionalString(body.employeeCode, 'profile.employeeCode', 80);
  const department = optionalString(body.department, 'profile.department', 120);
  const jobTitle = optionalString(body.jobTitle, 'profile.jobTitle', 120);
  const managerUserId = optionalString(body.managerUserId, 'profile.managerUserId', 64);
  const hireDate = optionalString(body.hireDate, 'profile.hireDate', 10);
  const terminationDate = optionalString(body.terminationDate, 'profile.terminationDate', 10);
  if (employeeCode !== undefined) profile.employeeCode = employeeCode;
  if (department !== undefined) profile.department = department;
  if (jobTitle !== undefined) profile.jobTitle = jobTitle;
  if (managerUserId !== undefined) profile.managerUserId = managerUserId;
  if (hireDate !== undefined) profile.hireDate = hireDate;
  if (terminationDate !== undefined) profile.terminationDate = terminationDate;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new ValidationError('profile.isActive must be a boolean');
    profile.isActive = body.isActive;
  }
  return profile;
}

export function validateCreateUserBody(value: unknown): CreateUserInput {
  const body = asObject(value);
  return {
    name: requiredString(body, 'name', 2, 120),
    email: normalizeEmail(body.email),
    temporaryPassword: parsePassword(body.temporaryPassword),
    status: parseStatus(body.status, 'active'),
    roles: parseStringArray(body.roles, 'roles'),
    permissions: parsePermissions(body.permissions, true) ?? [],
    allowedStages: parseStages(body.allowedStages, true) ?? [],
    profile: parseProfile(body.profile, true) ?? {},
  };
}

export function validateUpdateUserBody(value: unknown): UpdateUserInput {
  const body = asObject(value);
  const input: UpdateUserInput = {};
  if (body.name !== undefined) input.name = requiredString(body, 'name', 2, 120);
  if (body.email !== undefined) input.email = normalizeEmail(body.email);
  if (body.status !== undefined) input.status = parseStatus(body.status);
  if (body.roles !== undefined) input.roles = parseStringArray(body.roles, 'roles');
  const permissions = parsePermissions(body.permissions, false);
  if (permissions !== undefined) input.permissions = permissions;
  const stages = parseStages(body.allowedStages, false);
  if (stages !== undefined) input.allowedStages = stages;
  const profile = parseProfile(body.profile);
  if (profile !== undefined) input.profile = profile;
  if (Object.keys(input).length === 0) throw new ValidationError('No changes provided');
  return input;
}

export function validateResetPasswordBody(value: unknown): ResetPasswordInput {
  const body = asObject(value);
  return { temporaryPassword: parsePassword(body.temporaryPassword) };
}
