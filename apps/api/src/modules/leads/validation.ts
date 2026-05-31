import { PIPELINE_STAGE_KEYS, type PipelineStageKey } from '@enervita/shared';

export class ValidationError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new ValidationError(`${field} must be a valid UUID`);
  return value;
}

const PRIORITY_VALUES = ['baixa', 'media', 'alta', 'urgente'] as const;
export type PriorityLevel = (typeof PRIORITY_VALUES)[number];

export type ContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  consent?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateContactInput = Partial<ContactInput>;

export type CreateLeadInput = {
  contact: ContactInput;
  stage: PipelineStageKey;
  qualificationStatus?: string | null;
  leadSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  estimatedTicket?: number | null;
  sdrOwnerId?: string | null;
  priority?: PriorityLevel;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateLeadInput = {
  contact?: UpdateContactInput;
  qualificationStatus?: string | null;
  leadSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  estimatedTicket?: number | null;
  sdrOwnerId?: string | null;
  priority?: PriorityLevel;
  notes?: string | null;
  lostReason?: string | null;
  metadata?: Record<string, unknown>;
};

export type StageChangeInput = {
  stage: PipelineStageKey;
  notes?: string | null;
  lostReason?: string | null;
};

export type LeadTagMode = 'any' | 'all';

export type LeadListFilters = {
  tags: string[];
  tagMode: LeadTagMode;
};

export type SetLeadTagsInput = {
  tags: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return validateUuid(value, field);
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  return value.trim();
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ValidationError(`${field} is required`);
  return value.trim();
}

function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new ValidationError(`${field} must be a number`);
  return numeric;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be a boolean`);
  return value;
}

function optionalMetadata(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) throw new ValidationError(`${field} must be an object`);
  return value;
}

function parseStage(value: unknown, field = 'stage'): PipelineStageKey {
  if (typeof value !== 'string' || !PIPELINE_STAGE_KEYS.includes(value as PipelineStageKey)) {
    throw new ValidationError(`${field} must be a valid pipeline stage`);
  }
  return value as PipelineStageKey;
}

function parsePriority(value: unknown): PriorityLevel | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !PRIORITY_VALUES.includes(value as PriorityLevel)) {
    throw new ValidationError('priority must be valid');
  }
  return value as PriorityLevel;
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) delete input[key];
  }
  return input;
}

function parseContact(value: unknown, partial: false): ContactInput;
function parseContact(value: unknown, partial: true): UpdateContactInput;
function parseContact(value: unknown, partial: boolean): ContactInput | UpdateContactInput {
  if (!isObject(value)) throw new ValidationError('contact must be an object');
  const contact: UpdateContactInput = {};
  if (!partial || value.name !== undefined) contact.name = requiredString(value.name, 'contact.name');
  contact.email = optionalString(value.email, 'contact.email');
  contact.phone = optionalString(value.phone, 'contact.phone');
  contact.company = optionalString(value.company, 'contact.company');
  contact.source = optionalString(value.source, 'contact.source');
  contact.consent = optionalBoolean(value.consent, 'contact.consent');
  contact.metadata = optionalMetadata(value.metadata, 'contact.metadata');
  return pruneUndefined(contact as Record<string, unknown>) as ContactInput | UpdateContactInput;
}

export function validateCreateLeadBody(body: unknown): CreateLeadInput {
  if (!isObject(body)) throw new ValidationError('Request body must be an object');
  return {
    contact: parseContact(body.contact, false),
    stage: body.stage === undefined ? 'novo_lead' : parseStage(body.stage),
    qualificationStatus: optionalString(body.qualificationStatus, 'qualificationStatus'),
    leadSource: optionalString(body.leadSource, 'leadSource'),
    utmSource: optionalString(body.utmSource, 'utmSource'),
    utmMedium: optionalString(body.utmMedium, 'utmMedium'),
    utmCampaign: optionalString(body.utmCampaign, 'utmCampaign'),
    utmContent: optionalString(body.utmContent, 'utmContent'),
    utmTerm: optionalString(body.utmTerm, 'utmTerm'),
    fbp: optionalString(body.fbp, 'fbp'),
    fbc: optionalString(body.fbc, 'fbc'),
    fbclid: optionalString(body.fbclid, 'fbclid'),
    gclid: optionalString(body.gclid, 'gclid'),
    estimatedTicket: optionalNumber(body.estimatedTicket, 'estimatedTicket'),
    sdrOwnerId: optionalUuid(body.sdrOwnerId, 'sdrOwnerId'),
    priority: parsePriority(body.priority),
    notes: optionalString(body.notes, 'notes'),
    metadata: optionalMetadata(body.metadata, 'metadata'),
  };
}

export function validateUpdateLeadBody(body: unknown): UpdateLeadInput {
  if (!isObject(body)) throw new ValidationError('Request body must be an object');
  const input: UpdateLeadInput = {
    contact: body.contact === undefined ? undefined : parseContact(body.contact, true),
    qualificationStatus: optionalString(body.qualificationStatus, 'qualificationStatus'),
    leadSource: optionalString(body.leadSource, 'leadSource'),
    utmSource: optionalString(body.utmSource, 'utmSource'),
    utmMedium: optionalString(body.utmMedium, 'utmMedium'),
    utmCampaign: optionalString(body.utmCampaign, 'utmCampaign'),
    utmContent: optionalString(body.utmContent, 'utmContent'),
    utmTerm: optionalString(body.utmTerm, 'utmTerm'),
    fbp: optionalString(body.fbp, 'fbp'),
    fbc: optionalString(body.fbc, 'fbc'),
    fbclid: optionalString(body.fbclid, 'fbclid'),
    gclid: optionalString(body.gclid, 'gclid'),
    estimatedTicket: optionalNumber(body.estimatedTicket, 'estimatedTicket'),
    sdrOwnerId: optionalUuid(body.sdrOwnerId, 'sdrOwnerId'),
    priority: parsePriority(body.priority),
    notes: optionalString(body.notes, 'notes'),
    lostReason: optionalString(body.lostReason, 'lostReason'),
    metadata: optionalMetadata(body.metadata, 'metadata'),
  };
  return pruneUndefined(input as Record<string, unknown>) as UpdateLeadInput;
}

export function validateStageChangeBody(body: unknown): StageChangeInput {
  if (!isObject(body)) throw new ValidationError('Request body must be an object');
  return {
    stage: parseStage(body.stage),
    notes: optionalString(body.notes, 'notes'),
    lostReason: optionalString(body.lostReason, 'lostReason'),
  };
}


function normalizeTag(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new ValidationError(`${field} must not be empty`);
  if (normalized.length > 40) throw new ValidationError(`${field} must be at most 40 characters`);
  return normalized;
}

function uniqueTags(values: unknown[], field: string): string[] {
  const tags = Array.from(new Set(values.map((value, index) => normalizeTag(value, `${field}[${index}]`))));
  if (tags.length > 20) throw new ValidationError(`${field} must have at most 20 tags`);
  return tags;
}

export function validateListLeadsQuery(query: unknown): LeadListFilters {
  if (!isObject(query)) return { tags: [], tagMode: 'any' };
  const rawTags = query.tags;
  const tags = rawTags === undefined
    ? []
    : uniqueTags(Array.isArray(rawTags) ? rawTags : String(rawTags).split(','), 'tags');
  const tagMode = query.tagMode === undefined ? 'any' : query.tagMode;
  if (tagMode !== 'any' && tagMode !== 'all') throw new ValidationError('tagMode must be any or all');
  return { tags, tagMode };
}

export function validateSetLeadTagsBody(body: unknown): SetLeadTagsInput {
  if (!isObject(body)) throw new ValidationError('Request body must be an object');
  if (!Array.isArray(body.tags)) throw new ValidationError('tags must be an array');
  return { tags: uniqueTags(body.tags, 'tags') };
}
