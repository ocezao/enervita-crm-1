import { PIPELINE_STAGE_KEYS } from '@enervita/shared';

export class EngagementValidationError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIORITY_VALUES = ['baixa', 'media', 'alta', 'urgente'] as const;
const ACTIVITY_TYPES = ['call', 'email', 'whatsapp', 'meeting', 'note', 'stage_change'] as const;

export type PriorityLevel = (typeof PRIORITY_VALUES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type TaskInput = {
  leadId?: string | null;
  title: string;
  description?: string | null;
  priority?: PriorityLevel;
  ownerId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
};

export type ActivityInput = {
  leadId: string;
  activityType: ActivityType;
  outcome: string;
  responseTimeSeconds?: number | null;
  notes?: string | null;
  occurredAt?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new EngagementValidationError(`${field} must be a valid UUID`);
  return value;
}

function optionalUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return validateUuid(value, field);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new EngagementValidationError(`${field} is required`);
  return value.trim();
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new EngagementValidationError(`${field} must be a string`);
  return value.trim();
}

function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new EngagementValidationError(`${field} must be a number`);
  return numeric;
}

function parsePriority(value: unknown): PriorityLevel | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !PRIORITY_VALUES.includes(value as PriorityLevel)) throw new EngagementValidationError('priority must be valid');
  return value as PriorityLevel;
}

function parseActivityType(value: unknown): ActivityType {
  if (typeof value !== 'string' || !ACTIVITY_TYPES.includes(value as ActivityType)) throw new EngagementValidationError('activityType must be valid');
  return value as ActivityType;
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) delete input[key];
  }
  return input;
}

export function validateCreateTaskBody(body: unknown): TaskInput {
  if (!isObject(body)) throw new EngagementValidationError('Request body must be an object');
  return pruneUndefined({
    leadId: optionalUuid(body.leadId, 'leadId'),
    title: requiredString(body.title, 'title'),
    description: optionalString(body.description, 'description'),
    priority: parsePriority(body.priority),
    ownerId: optionalUuid(body.ownerId, 'ownerId'),
    dueDate: optionalString(body.dueDate, 'dueDate'),
    notes: optionalString(body.notes, 'notes'),
  });
}

export function validateCreateActivityBody(leadId: string, body: unknown): ActivityInput {
  if (!isObject(body)) throw new EngagementValidationError('Request body must be an object');
  return pruneUndefined({
    leadId,
    activityType: body.activityType === undefined ? 'note' : parseActivityType(body.activityType),
    outcome: requiredString(body.outcome, 'outcome'),
    responseTimeSeconds: optionalNumber(body.responseTimeSeconds, 'responseTimeSeconds'),
    notes: optionalString(body.notes, 'notes'),
    occurredAt: optionalString(body.occurredAt, 'occurredAt'),
  });
}

export function assertKnownStage(stage: unknown): void {
  if (typeof stage !== 'string' || !PIPELINE_STAGE_KEYS.includes(stage as never)) throw new EngagementValidationError('stage must be valid');
}
