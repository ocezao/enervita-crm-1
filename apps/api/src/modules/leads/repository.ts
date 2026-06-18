import { createHash } from 'node:crypto';
import pg, { type PoolClient } from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AuditContext } from '../users/repository.ts';
import type { ContactInput, CreateLeadInput, LeadListFilters, SetLeadTagsInput, UpdateLeadInput } from './validation.ts';

const { Pool } = pg;

export type LeadContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  consent: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type LeadTag = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

export type LeadOpportunity = {
  id: string;
  leadId: string;
  title: string;
  status: 'open' | 'won' | 'lost';
  expectedValue: string | null;
  probability: number;
  convertedBy: string | null;
  convertedAt: string;
  acceptedProposalId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Lead = {
  id: string;
  tenantId: string;
  contactId: string;
  stage: PipelineStageKey;
  qualificationStatus: string | null;
  leadSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  gclid: string | null;
  estimatedTicket: string | null;
  sdrOwnerId: string | null;
  sdrOwner: string | null;
  nextActionAt: string | null;
  priority: string;
  notes: string | null;
  lostReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contact: LeadContact;
  tags: LeadTag[];
  opportunity: LeadOpportunity | null;
};

export type LeadHistoryChange = {
  field: 'stage' | 'priority' | 'qualificationStatus' | 'leadSource' | 'estimatedTicket' | 'notes' | 'tags';
  label: string;
  before: unknown;
  after: unknown;
};

export type LeadHistoryEvent = {
  id: string;
  action: string;
  occurredAt: string;
  summary: string;
  actor: { id: string; name: string; email: string } | null;
  changes: LeadHistoryChange[];
  stage: PipelineStageKey | null;
};

export type LeadDocument = {
  id: string;
  tenantId: string;
  leadId: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  previewUrl: string;
  downloadUrl: string;
  storageBackend: 'postgres' | 'legacy_url' | 'external_url';
  checksumSha256: string | null;
  isPublic: boolean;
  uploadedByUserId: string | null;
  uploadedByUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadDocumentContent = LeadDocument & {
  content: Buffer | null;
};

export type AddLeadDocumentInput = {
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileData?: Buffer | null;
  fileUrl?: string | null;
  storageBackend?: LeadDocument['storageBackend'];
  uploadedByUserAgent?: string | null;
};

export type LeadsRepository = {
  listLeads(tenantId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, filters?: LeadListFilters): Promise<Lead[]>;
  getLead(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Lead | null>;
  listLeadHistory(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<LeadHistoryEvent[]>;
  createLead(context: AuditContext, input: CreateLeadInput): Promise<Lead>;
  updateLead(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: UpdateLeadInput): Promise<Lead>;
  changeStage(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, targetStage: PipelineStageKey, notes?: string | null, lostReason?: string | null, createOpportunity?: boolean): Promise<Lead>;
  setLeadTags(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: SetLeadTagsInput): Promise<Lead>;
  bulkSetLeadTags(context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: SetLeadTagsInput): Promise<Lead[]>;
  deleteLead(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<void>;
  bulkDeleteLeads(context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<{ deleted: number }>;
  listLeadDocuments(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<LeadDocument[]>;
  addLeadDocument(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: AddLeadDocumentInput): Promise<LeadDocument>;
  getLeadDocumentContent(tenantId: string, leadId: string, documentId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<LeadDocumentContent | null>;
  deleteLeadDocument(context: AuditContext, leadId: string, documentId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<void>;
  countStageHistory?(tenantId: string, leadId: string): Promise<number>;
  close?(): Promise<void>;
};

export class LeadsNotFoundError extends Error {}
export class LeadsOperationError extends Error {}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function tagArray(value: unknown): LeadTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? item.slug ?? ''),
      slug: String(item.slug ?? item.name ?? ''),
      color: typeof item.color === 'string' ? item.color : null,
    }))
    .filter((tag) => tag.id && tag.slug);
}

function historyJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function historyStage(...values: unknown[]): PipelineStageKey | null {
  for (const value of values) {
    if (typeof value === 'string') return value as PipelineStageKey;
  }
  return null;
}

function historyTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const row = item as Record<string, unknown>;
        return typeof row.slug === 'string' ? row.slug : typeof row.name === 'string' ? row.name : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

const HISTORY_FIELD_LABELS: Record<LeadHistoryChange['field'], string> = {
  stage: 'Etapa',
  priority: 'Prioridade',
  qualificationStatus: 'Status de qualificação',
  leadSource: 'Origem',
  estimatedTicket: 'Ticket estimado',
  notes: 'Observações',
  tags: 'Tags',
};

const HISTORY_ACTION_SUMMARIES: Record<string, string> = {
  'lead.created': 'Lead criado',
  'lead.updated': 'Lead atualizado',
  'lead.stage_changed': 'Etapa alterada',
  'lead.tags_updated': 'Tags atualizadas',
  'lead.deleted': 'Lead excluído',
};

function historyValue(data: Record<string, unknown> | null, field: LeadHistoryChange['field']): unknown {
  if (!data) return null;
  if (field === 'tags') return historyTags(data.tags);
  return data[field] ?? null;
}

function valuesEqual(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

function rowToLeadHistoryEvent(row: Record<string, unknown>): LeadHistoryEvent {
  const before = historyJsonObject(row.beforeData);
  const after = historyJsonObject(row.afterData);
  const fields: LeadHistoryChange['field'][] = ['stage', 'priority', 'qualificationStatus', 'leadSource', 'estimatedTicket', 'notes', 'tags'];
  const changes = fields
    .map((field) => ({ field, label: HISTORY_FIELD_LABELS[field], before: historyValue(before, field), after: historyValue(after, field) }))
    .filter((change) => !valuesEqual(change.before, change.after));
  return {
    id: row.id as string,
    action: row.action as string,
    occurredAt: row.occurredAt as string,
    summary: HISTORY_ACTION_SUMMARIES[row.action as string] ?? String(row.action ?? 'Alteração'),
    actor: row.actorId ? { id: row.actorId as string, name: row.actorName as string, email: row.actorEmail as string } : null,
    changes,
    stage: historyStage(after?.stage, before?.stage),
  };
}

function documentPublicUrls(leadId: string, documentId: string) {
  const encodedLeadId = encodeURIComponent(leadId);
  const encodedDocumentId = encodeURIComponent(documentId);
  return {
    previewUrl: `/api/leads/${encodedLeadId}/documents/${encodedDocumentId}/preview`,
    downloadUrl: `/api/leads/${encodedLeadId}/documents/${encodedDocumentId}/download`,
  };
}

function rowToLeadDocument(row: Record<string, unknown>): LeadDocument {
  const id = String(row.id);
  const leadId = String(row.leadId);
  const urls = documentPublicUrls(leadId, id);
  return {
    id,
    tenantId: String(row.tenantId),
    leadId,
    fileName: String(row.fileName ?? 'document'),
    mimeType: row.mimeType ? String(row.mimeType) : null,
    fileSize: row.fileSize === null || row.fileSize === undefined ? null : Number(row.fileSize),
    fileUrl: row.fileUrl ? String(row.fileUrl) : null,
    previewUrl: urls.previewUrl,
    downloadUrl: urls.downloadUrl,
    storageBackend: (row.storageBackend as LeadDocument['storageBackend']) ?? 'postgres',
    checksumSha256: row.checksumSha256 ? String(row.checksumSha256) : null,
    isPublic: row.isPublic === true,
    uploadedByUserId: row.uploadedByUserId ? String(row.uploadedByUserId) : null,
    uploadedByUserAgent: row.uploadedByUserAgent ? String(row.uploadedByUserAgent) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function rowToLeadDocumentContent(row: Record<string, unknown>): LeadDocumentContent {
  return {
    ...rowToLeadDocument(row),
    content: Buffer.isBuffer(row.content) ? row.content : null,
  };
}

function rowHistoryStage(row: Record<string, unknown>): PipelineStageKey | null {
  const before = historyJsonObject(row.beforeData);
  const after = historyJsonObject(row.afterData);
  return historyStage(after?.stage, before?.stage);
}

function rowToOpportunity(row: Record<string, unknown>): LeadOpportunity | null {
  if (!row.opportunityId) return null;
  return {
    id: String(row.opportunityId),
    leadId: String(row.opportunityLeadId ?? row.id),
    title: String(row.opportunityTitle ?? ''),
    status: String(row.opportunityStatus ?? 'open') as LeadOpportunity['status'],
    expectedValue: row.opportunityExpectedValue === null || row.opportunityExpectedValue === undefined ? null : String(row.opportunityExpectedValue),
    probability: Number(row.opportunityProbability ?? 0),
    convertedBy: row.opportunityConvertedBy ? String(row.opportunityConvertedBy) : null,
    convertedAt: String(row.opportunityConvertedAt ?? row.created_at),
    acceptedProposalId: row.opportunityAcceptedProposalId ? String(row.opportunityAcceptedProposalId) : null,
    acceptedAt: row.opportunityAcceptedAt ? String(row.opportunityAcceptedAt) : null,
    createdAt: String(row.opportunityCreatedAt ?? row.created_at),
    updatedAt: String(row.opportunityUpdatedAt ?? row.updated_at),
  };
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    contactId: row.contactId as string,
    stage: row.stage as PipelineStageKey,
    qualificationStatus: row.qualificationStatus as string | null,
    leadSource: row.leadSource as string | null,
    utmSource: row.utmSource as string | null,
    utmMedium: row.utmMedium as string | null,
    utmCampaign: row.utmCampaign as string | null,
    utmContent: row.utmContent as string | null,
    utmTerm: row.utmTerm as string | null,
    fbp: row.fbp as string | null,
    fbc: row.fbc as string | null,
    fbclid: row.fbclid as string | null,
    gclid: row.gclid as string | null,
    estimatedTicket: row.estimatedTicket as string | null,
    sdrOwnerId: row.sdrOwnerId as string | null,
    sdrOwner: row.sdrOwner as string | null,
    nextActionAt: row.nextActionAt as string | null,
    priority: row.priority as string,
    notes: row.notes as string | null,
    lostReason: row.lostReason as string | null,
    metadata: jsonObject(row.metadata),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    tags: tagArray(row.tags),
    opportunity: rowToOpportunity(row),
    contact: {
      id: row.contactId as string,
      name: row.contactName as string,
      email: row.contactEmail as string | null,
      phone: row.contactPhone as string | null,
      company: row.contactCompany as string | null,
      source: row.contactSource as string | null,
      consent: row.contactConsent as boolean,
      metadata: jsonObject(row.contactMetadata),
      createdAt: row.contactCreatedAt as string,
      updatedAt: row.contactUpdatedAt as string,
    },
  };
}

const leadSelect = `select l.id,
                          l.tenant_id as "tenantId",
                          l.contact_id as "contactId",
                          l.stage::text as stage,
                          l.qualification_status as "qualificationStatus",
                          l.lead_source as "leadSource",
                          l.utm_source as "utmSource",
                          l.utm_medium as "utmMedium",
                          l.utm_campaign as "utmCampaign",
                          l.utm_content as "utmContent",
                          l.utm_term as "utmTerm",
                          l.fbp,
                          l.fbc,
                          l.fbclid,
                          l.gclid,
                          l.estimated_ticket::text as "estimatedTicket",
                          l.sdr_owner_id as "sdrOwnerId",
                          owner_user.name as "sdrOwner",
                          lo.id as "opportunityId",
                          lo.lead_id as "opportunityLeadId",
                          lo.title as "opportunityTitle",
                          lo.status as "opportunityStatus",
                          lo.expected_value as "opportunityExpectedValue",
                          lo.probability as "opportunityProbability",
                          lo.converted_by as "opportunityConvertedBy",
                          lo.converted_at::text as "opportunityConvertedAt",
                          lo.accepted_proposal_id as "opportunityAcceptedProposalId",
                          lo.accepted_at::text as "opportunityAcceptedAt",
                          lo.created_at::text as "opportunityCreatedAt",
                          lo.updated_at::text as "opportunityUpdatedAt",
                          l.next_action_at::text as "nextActionAt",
                          l.priority::text as priority,
                          l.notes,
                          l.lost_reason as "lostReason",
                          l.metadata,
                          l.created_at::text as "createdAt",
                          l.updated_at::text as "updatedAt",
                          c.name as "contactName",
                          c.email as "contactEmail",
                          c.phone as "contactPhone",
                          c.company as "contactCompany",
                          c.source as "contactSource",
                          c.consent as "contactConsent",
                          c.metadata as "contactMetadata",
                          c.created_at::text as "contactCreatedAt",
                          c.updated_at::text as "contactUpdatedAt",
                          coalesce(tag_rows.tags, '[]'::jsonb) as tags
                     from leads l
                     join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
                     left join users owner_user on owner_user.tenant_id = l.tenant_id and owner_user.id = l.sdr_owner_id
                     left join lead_opportunities lo on lo.tenant_id = l.tenant_id and lo.lead_id = l.id
                     left join lateral (
                       select jsonb_agg(jsonb_build_object('id', lt.id::text, 'name', lt.name, 'slug', lt.slug, 'color', lt.color) order by lt.name) as tags
                         from lead_tag_assignments lta
                         join lead_tags lt on lt.tenant_id = lta.tenant_id and lt.id = lta.tag_id
                        where lta.tenant_id = l.tenant_id and lta.lead_id = l.id
                     ) tag_rows on true`;

const leadDocumentSelect = `select d.id,
                                   d.tenant_id as "tenantId",
                                   d.lead_id as "leadId",
                                   d.file_name as "fileName",
                                   d.mime_type as "mimeType",
                                   d.file_size as "fileSize",
                                   d.file_url as "fileUrl",
                                   d.storage_backend as "storageBackend",
                                   d.checksum_sha256 as "checksumSha256",
                                   d.is_public as "isPublic",
                                   d.uploaded_by_user_id as "uploadedByUserId",
                                   d.uploaded_by_user_agent as "uploadedByUserAgent",
                                   d.created_at::text as "createdAt",
                                   d.updated_at::text as "updatedAt"
                              from lead_documents d
                              join leads l on l.tenant_id = d.tenant_id and l.id = d.lead_id`;

const leadDocumentContentSelect = `select d.id,
                                          d.tenant_id as "tenantId",
                                          d.lead_id as "leadId",
                                          d.file_name as "fileName",
                                          d.mime_type as "mimeType",
                                          d.file_size as "fileSize",
                                          d.file_data as content,
                                          d.file_url as "fileUrl",
                                          d.storage_backend as "storageBackend",
                                          d.checksum_sha256 as "checksumSha256",
                                          d.is_public as "isPublic",
                                          d.uploaded_by_user_id as "uploadedByUserId",
                                          d.uploaded_by_user_agent as "uploadedByUserAgent",
                                          d.created_at::text as "createdAt",
                                          d.updated_at::text as "updatedAt"
                                     from lead_documents d
                                     join leads l on l.tenant_id = d.tenant_id and l.id = d.lead_id`;

function stageClause(allowedStages: PipelineStageKey[] | null, offset: number): string {
  return allowedStages === null ? '' : ` and l.stage = any($${offset}::lead_stage[])`;
}

function stageParams(allowedStages: PipelineStageKey[] | null): unknown[] {
  return allowedStages === null ? [] : [allowedStages];
}

function ownerClause(ownerUserId: string | null, offset: number): string {
  return ownerUserId === null ? '' : ` and l.sdr_owner_id = ${offset}::uuid`;
}

function ownerParams(ownerUserId: string | null): unknown[] {
  return ownerUserId === null ? [] : [ownerUserId];
}

async function resolveSdrOwnerId(client: PoolClient, tenantId: string, requestedOwnerId?: string | null): Promise<string | null> {
  if (requestedOwnerId) return requestedOwnerId;
  const result = await client.query(
    `select u.id::text as id
       from users u
       join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
       join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
      where u.tenant_id = $1
        and u.status = 'active'
        and r.name in ('sdr', 'vendedor', 'seller', 'closer')
        and not exists (
          select 1
            from user_roles admin_ur
            join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
           where admin_ur.tenant_id = u.tenant_id
             and admin_ur.user_id = u.id
             and admin_r.name = 'admin'
        )
      group by u.id, u.name
      order by (select count(*) from leads l where l.tenant_id = u.tenant_id and l.sdr_owner_id = u.id) asc,
               u.name asc,
               u.id asc
      limit 1`,
    [tenantId],
  );
  return (result.rows[0]?.id as string | undefined) ?? null;
}

function tagFilterClause(filters: LeadListFilters | undefined, offset: number): { clause: string; params: unknown[] } {
  if (!filters?.tags.length) return { clause: '', params: [] };
  if (filters.tagMode === 'all') {
    return {
      clause: ` and (select count(distinct lt.slug)
                      from lead_tag_assignments lta
                      join lead_tags lt on lt.tenant_id = lta.tenant_id and lt.id = lta.tag_id
                     where lta.tenant_id = l.tenant_id and lta.lead_id = l.id and lt.slug = any($${offset}::text[])) = $${offset + 1}`,
      params: [filters.tags, filters.tags.length],
    };
  }
  return {
    clause: ` and exists (select 1
                           from lead_tag_assignments lta
                           join lead_tags lt on lt.tenant_id = lta.tenant_id and lt.id = lta.tag_id
                          where lta.tenant_id = l.tenant_id and lta.lead_id = l.id and lt.slug = any($${offset}::text[]))`,
    params: [filters.tags],
  };
}

async function selectOne(client: PoolClient, tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, forUpdate = false): Promise<Lead | null> {
  const params = [tenantId, leadId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
  const result = await client.query(
    `${leadSelect}
      where l.tenant_id = $1 and l.id = $2${stageClause(allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
      limit 1${forUpdate ? ' for update of l, c' : ''}`,
    params,
  );
  return result.rows[0] ? rowToLead(result.rows[0]) : null;
}

async function writeAudit(client: PoolClient, context: AuditContext, entityId: string, action: string, before: Lead | null, after: Lead | null): Promise<void> {
  await client.query(
    `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, ip_address, user_agent)
     values ($1, $2, 'lead', $3, $4, $5::jsonb, $6::jsonb, nullif($7, '')::inet, $8)`,
    [context.tenantId, context.actorUserId, entityId, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, context.ipAddress ?? null, context.userAgent ?? null],
  );
}

async function writeLeadDocumentAudit(client: PoolClient, context: AuditContext, entityId: string, action: string, beforeData: unknown, afterData: unknown): Promise<void> {
  await client.query(
    `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, ip_address, user_agent)
     values ($1, $2, 'lead_document', $3, $4, $5::jsonb, $6::jsonb, nullif($7, '')::inet, $8)`,
    [context.tenantId, context.actorUserId, entityId, action, beforeData ? JSON.stringify(beforeData) : null, afterData ? JSON.stringify(afterData) : null, context.ipAddress ?? null, context.userAgent ?? null],
  );
}

async function createOpportunityForLead(client: PoolClient, context: AuditContext, lead: Lead): Promise<void> {
  await client.query(
    `insert into lead_opportunities (tenant_id, lead_id, title, expected_value, probability, converted_by, metadata)
     values ($1, $2, $3, $4, 60, $5, $6::jsonb)
     on conflict (tenant_id, lead_id) do nothing`,
    [
      context.tenantId,
      lead.id,
      `Oportunidade — ${lead.contact.name}`,
      lead.estimatedTicket,
      context.actorUserId,
      JSON.stringify({ source: 'lead_conversion', fromStage: lead.stage }),
    ],
  );
}

const META_STAGE_EVENTS: Partial<Record<PipelineStageKey, string>> = {
  novo_lead: 'Lead',
  qualificacao: 'EnervitaPreQualifiedLead',
  atendimento_iniciado: 'EnervitaOpportunity',
  conta_recebida: 'EnervitaBillReceived',
  diagnostico: 'EnervitaQualifiedLead',
  proposta_enviada: 'ProposalSent',
  contrato_enervita: 'WonLead',
  perdido: 'LeadUnqualified',
};

const META_STAGE_ORDER: Record<PipelineStageKey, number> = {
  novo_lead: 1,
  qualificacao: 2,
  atendimento_iniciado: 3,
  conta_recebida: 4,
  diagnostico: 5,
  proposta_enviada: 6,
  contrato_enervita: 7,
  perdido: 8,
};

function transitionDirection(action: 'created' | 'stage_changed' | 'tags_updated', stage: PipelineStageKey, fromStage?: PipelineStageKey | null): 'created' | 'forward' | 'backward' | 'lateral' | 'tags_updated' {
  if (action === 'created') return 'created';
  if (action === 'tags_updated') return 'tags_updated';
  if (!fromStage || fromStage === stage) return 'lateral';
  return META_STAGE_ORDER[stage] > META_STAGE_ORDER[fromStage] ? 'forward' : 'backward';
}

function nestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const compact = value.trim().replace(/[^\d.,-]/g, '');
      const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function qualificationMetadata(lead: Lead): Record<string, unknown> {
  const leadMetadata = jsonObject(lead.metadata);
  const contactMetadata = jsonObject(lead.contact.metadata);
  return {
    status: lead.qualificationStatus,
    priority: lead.priority,
    estimatedTicket: firstNumber(lead.estimatedTicket),
    energyBillValue: firstNumber(leadMetadata.energyBillValue, leadMetadata.billValue, leadMetadata.contaMediaMensal, leadMetadata.monthlyBillValue),
    averageConsumptionKwh: firstNumber(leadMetadata.averageConsumptionKwh, leadMetadata.consumoMedioKwh, leadMetadata.estimatedKwh),
    concessionaria: firstString(leadMetadata.concessionaria, contactMetadata.concessionaria),
    offer: firstString(leadMetadata.offer, leadMetadata.ofertaEnervita, leadMetadata.oferta),
    projectedSavings: firstNumber(leadMetadata.projectedSavings, leadMetadata.economiaMensalProjetada, leadMetadata.projectedMonthlySavings),
    score: firstNumber(leadMetadata.qualificationScore, leadMetadata.score, leadMetadata.leadScore),
    reason: firstString(leadMetadata.qualificationReason, leadMetadata.motivoQualificacao, leadMetadata.diagnosisReason),
  };
}

function crmSignalMetadata(lead: Lead, _context: AuditContext): Record<string, unknown> {
  const leadMetadata = jsonObject(lead.metadata);
  const contactMetadata = jsonObject(lead.contact.metadata);
  const rawIpStored = Boolean(nestedString(leadMetadata, ['request', 'clientIpAddress']) || nestedString(contactMetadata, ['request', 'clientIpAddress']));
  const request = {
    // Meta CAPI customer_information should describe the customer, not the CRM operator.
    // Do not fall back to context.ipAddress/context.userAgent here: stage changes are usually triggered by an admin inside the CRM.
    clientIpAddress: rawIpStored ? firstString(nestedString(leadMetadata, ['request', 'clientIpAddress']), nestedString(contactMetadata, ['request', 'clientIpAddress'])) : null,
    clientUserAgent: firstString(nestedString(leadMetadata, ['request', 'clientUserAgent']), nestedString(contactMetadata, ['request', 'clientUserAgent']), nestedString(leadMetadata, ['request', 'userAgent']), nestedString(contactMetadata, ['request', 'userAgent'])),
  };
  const location = {
    city: firstString(leadMetadata.city, leadMetadata.cidade, contactMetadata.city, contactMetadata.cidade),
    state: firstString(leadMetadata.state, leadMetadata.estado, contactMetadata.state, contactMetadata.estado),
    country: firstString(leadMetadata.country, leadMetadata.pais, contactMetadata.country, contactMetadata.pais, 'BR'),
  };
  return {
    request,
    location,
    contact: {
      name: lead.contact.name,
      company: lead.contact.company,
      source: lead.contact.source,
    },
    leadEventSource: 'Enervita Custom CRM',
  };
}

function buildMetaStageEventPayload(lead: Lead, context: AuditContext, action: 'created' | 'stage_changed' | 'tags_updated', fromStage?: PipelineStageKey | null): Record<string, unknown> {
  return {
    action,
    leadId: lead.id,
    stage: lead.stage,
    fromStage: fromStage ?? null,
    transitionDirection: transitionDirection(action, lead.stage, fromStage),
    source: lead.leadSource,
    utm: {
      source: lead.utmSource,
      medium: lead.utmMedium,
      campaign: lead.utmCampaign,
      content: lead.utmContent,
      term: lead.utmTerm,
    },
    attribution: {
      fbp: lead.fbp,
      fbc: lead.fbc,
      fbclid: lead.fbclid,
      gclid: lead.gclid,
    },
    tags: lead.tags.map((tag) => tag.slug),
    priority: lead.priority,
    qualificationStatus: lead.qualificationStatus,
    qualification: qualificationMetadata(lead),
    estimatedTicket: lead.estimatedTicket,
    actorUserId: context.actorUserId,
    ...crmSignalMetadata(lead, context),
  };
}

export function buildMetaStageEventPayloadForTest(lead: Lead, context: AuditContext, action: 'created' | 'stage_changed' | 'tags_updated', fromStage?: PipelineStageKey | null): Record<string, unknown> {
  return buildMetaStageEventPayload(lead, context, action, fromStage);
}

const MANUAL_STAGE_CHANGE_CAPI_DELAY_MINUTES = 10;

async function debounceQueuedManualStageChangeEvents(client: PoolClient, context: AuditContext, leadId: string): Promise<void> {
  await client.query(
    `update tracking_events
        set status = 'discarded'::delivery_status,
            error_message = 'superseded by a newer manual Kanban stage change before debounce window elapsed',
            next_retry_at = null,
            updated_at = now()
      where tenant_id = $1
        and lead_id = $2
        and platform = 'meta'
        and status = 'queued'
        and payload->>'action' = 'stage_changed'
        and next_retry_at is not null
        and next_retry_at > now()`,
    [context.tenantId, leadId],
  );
}

async function queueMetaStageEvent(client: PoolClient, context: AuditContext, lead: Lead, action: 'created' | 'stage_changed' | 'tags_updated', fromStage?: PipelineStageKey | null): Promise<void> {
  const eventName = META_STAGE_EVENTS[lead.stage];
  if (!eventName) return;
  if (action === 'stage_changed' && fromStage === lead.stage) return;
  if (action === 'stage_changed') await debounceQueuedManualStageChangeEvents(client, context, lead.id);
  const payload = buildMetaStageEventPayload(lead, context, action, fromStage);
  const nextRetryAtSql = action === 'stage_changed' ? `now() + interval '${MANUAL_STAGE_CHANGE_CAPI_DELAY_MINUTES} minutes'` : 'now()';
  await client.query(
    `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
     values ($1, $2, 'meta', $3, 'queued', $4::jsonb, ${nextRetryAtSql})`,
    [context.tenantId, lead.id, eventName, JSON.stringify(payload)],
  );
}

export function queueMetaStageEventForTest(client: PoolClient, context: AuditContext, lead: Lead, action: 'created' | 'stage_changed' | 'tags_updated', fromStage?: PipelineStageKey | null): Promise<void> {
  return queueMetaStageEvent(client, context, lead, action, fromStage);
}

async function insertContact(client: PoolClient, tenantId: string, input: ContactInput): Promise<string> {
  const result = await client.query(
    `insert into contacts (tenant_id, name, email, phone, company, source, consent, metadata)
     values ($1, $2, $3, $4, $5, $6, coalesce($7, false), coalesce($8::jsonb, '{}'::jsonb))
     returning id`,
    [tenantId, input.name, input.email ?? null, input.phone ?? null, input.company ?? null, input.source ?? null, input.consent ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
  );
  return result.rows[0].id as string;
}

export function createPgLeadsRepository(databaseUrl: string): LeadsRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async listLeads(tenantId, allowedStages, ownerUserId, filters) {
      const baseParams = [tenantId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
      const tagFilter = tagFilterClause(filters, baseParams.length + 1);
      const result = await pool.query(
        `${leadSelect}
          where l.tenant_id = $1${stageClause(allowedStages, 2)}${ownerClause(ownerUserId, 2 + stageParams(allowedStages).length)}${tagFilter.clause}
          order by l.updated_at desc, l.created_at desc`,
        [...baseParams, ...tagFilter.params],
      );
      return result.rows.map(rowToLead);
    },
    async getLead(tenantId, leadId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        return await selectOne(client, tenantId, leadId, allowedStages, ownerUserId);
      } finally {
        client.release();
      }
    },
    async listLeadHistory(tenantId, leadId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        const currentLead = await selectOne(client, tenantId, leadId, null, null);
        if (currentLead && allowedStages !== null && !allowedStages.includes(currentLead.stage)) throw new LeadsNotFoundError('Lead not found');
        if (currentLead && ownerUserId !== null && currentLead.sdrOwnerId !== ownerUserId) throw new LeadsNotFoundError('Lead not found');
        const result = await client.query(
          `select a.id::text as id,
                  a.action,
                  a.before_data as "beforeData",
                  a.after_data as "afterData",
                  a.created_at::text as "occurredAt",
                  u.id::text as "actorId",
                  u.name as "actorName",
                  u.email as "actorEmail"
             from audit_logs a
             left join users u on u.tenant_id = a.tenant_id and u.id = a.actor_user_id
            where a.tenant_id = $1 and a.entity_type = 'lead' and a.entity_id = $2
            order by a.created_at desc, a.id desc`,
          [tenantId, leadId],
        );
        const scopedRows = allowedStages === null ? result.rows : result.rows.filter((row) => {
          const stage = rowHistoryStage(row);
          return stage !== null && allowedStages.includes(stage);
        });
        if (!currentLead && scopedRows.length === 0) throw new LeadsNotFoundError('Lead not found');
        return scopedRows.map(rowToLeadHistoryEvent);
      } finally {
        client.release();
      }
    },
    async createLead(context, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const contactId = await insertContact(client, context.tenantId, input.contact);
        const sdrOwnerId = await resolveSdrOwnerId(client, context.tenantId, input.sdrOwnerId);
        const leadResult = await client.query(
          `insert into leads (tenant_id, contact_id, stage, qualification_status, lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbp, fbc, fbclid, gclid, estimated_ticket, sdr_owner_id, priority, notes, metadata)
           values ($1, $2, $3::lead_stage, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, coalesce($17::priority_level, 'media'), $18, coalesce($19::jsonb, '{}'::jsonb))
           returning id`,
          [context.tenantId, contactId, input.stage, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.utmContent ?? null, input.utmTerm ?? null, input.fbp ?? firstString(input.metadata?.fbp, nestedString(input.metadata, ['attribution', 'fbp']), input.contact.metadata?.fbp), input.fbc ?? firstString(input.metadata?.fbc, nestedString(input.metadata, ['attribution', 'fbc']), input.contact.metadata?.fbc), input.fbclid ?? firstString(input.metadata?.fbclid, nestedString(input.metadata, ['attribution', 'fbclid']), input.contact.metadata?.fbclid), input.gclid ?? firstString(input.metadata?.gclid, nestedString(input.metadata, ['attribution', 'gclid']), input.contact.metadata?.gclid), input.estimatedTicket ?? null, sdrOwnerId, input.priority ?? null, input.notes ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
        );
        const leadId = leadResult.rows[0].id as string;
        await client.query(
          `insert into lead_stage_history (tenant_id, lead_id, from_stage, to_stage, changed_by, notes)
           values ($1, $2, null, $3::lead_stage, $4, 'lead.created')`,
          [context.tenantId, leadId, input.stage, context.actorUserId],
        );
        const lead = await selectOne(client, context.tenantId, leadId, null, null);
        if (!lead) throw new LeadsNotFoundError('Lead not found after create');
        await writeAudit(client, context, leadId, 'lead.created', null, lead);
        if (sdrOwnerId) await writeAudit(client, context, leadId, 'lead.assigned', null, lead);
        await queueMetaStageEvent(client, context, lead, 'created', null);
        await client.query('commit');
        return lead;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateLead(context, leadId, allowedStages, ownerUserId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!before) throw new LeadsNotFoundError('Lead not found');
        if (input.contact) {
          await client.query(
            `update contacts
                set name = coalesce($3, name), email = coalesce($4, email), phone = coalesce($5, phone), company = coalesce($6, company),
                    source = coalesce($7, source), consent = coalesce($8, consent), metadata = coalesce($9::jsonb, metadata), updated_at = now()
              where tenant_id = $1 and id = $2`,
            [context.tenantId, before.contactId, input.contact.name ?? null, input.contact.email ?? null, input.contact.phone ?? null, input.contact.company ?? null, input.contact.source ?? null, input.contact.consent ?? null, input.contact.metadata ? JSON.stringify(input.contact.metadata) : null],
          );
        }
        await client.query(
          `update leads
              set qualification_status = coalesce($3, qualification_status), lead_source = coalesce($4, lead_source), utm_source = coalesce($5, utm_source),
                  utm_medium = coalesce($6, utm_medium), utm_campaign = coalesce($7, utm_campaign), utm_content = coalesce($8, utm_content),
                  utm_term = coalesce($9, utm_term), fbp = coalesce($10, fbp), fbc = coalesce($11, fbc), fbclid = coalesce($12, fbclid),
                  gclid = coalesce($13, gclid), estimated_ticket = coalesce($14, estimated_ticket), sdr_owner_id = coalesce($15, sdr_owner_id),
                  priority = coalesce($16::priority_level, priority), notes = coalesce($17, notes), lost_reason = coalesce($18, lost_reason),
                  metadata = coalesce($19::jsonb, metadata), updated_at = now()
            where tenant_id = $1 and id = $2`,
          [context.tenantId, leadId, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.utmContent ?? null, input.utmTerm ?? null, input.fbp ?? null, input.fbc ?? null, input.fbclid ?? null, input.gclid ?? null, input.estimatedTicket ?? null, input.sdrOwnerId ?? null, input.priority ?? null, input.notes ?? null, input.lostReason ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
        );
        const after = await selectOne(client, context.tenantId, leadId, null, null);
        if (!after) throw new LeadsNotFoundError('Lead not found after update');
        await writeAudit(client, context, leadId, 'lead.updated', before, after);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async changeStage(context, leadId, allowedStages, ownerUserId, targetStage, notes = null, lostReason = null, createOpportunity = false) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!before) throw new LeadsNotFoundError('Lead not found');
        await client.query(
          `update leads
              set stage = $3::lead_stage, lost_reason = coalesce($4, lost_reason), updated_at = now()
            where tenant_id = $1 and id = $2`,
          [context.tenantId, leadId, targetStage, lostReason ?? null],
        );
        await client.query(
          `insert into lead_stage_history (tenant_id, lead_id, from_stage, to_stage, changed_by, notes)
           values ($1, $2, $3::lead_stage, $4::lead_stage, $5, $6)`,
          [context.tenantId, leadId, before.stage, targetStage, context.actorUserId, notes ?? null],
        );
        let after = await selectOne(client, context.tenantId, leadId, null, null);
        if (!after) throw new LeadsNotFoundError('Lead not found after stage change');
        if (createOpportunity) {
          await createOpportunityForLead(client, context, after);
          after = await selectOne(client, context.tenantId, leadId, null, null);
          if (!after) throw new LeadsNotFoundError('Lead not found after opportunity conversion');
        }
        await writeAudit(client, context, leadId, createOpportunity ? 'lead.converted_to_opportunity' : 'lead.stage_changed', before, after);
        await queueMetaStageEvent(client, context, after, 'stage_changed', before.stage);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async setLeadTags(context, leadId, allowedStages, ownerUserId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!before) throw new LeadsNotFoundError('Lead not found');
        await client.query('delete from lead_tag_assignments where tenant_id = $1 and lead_id = $2', [context.tenantId, leadId]);
        for (const slug of input.tags) {
          const tagResult = await client.query(
            `insert into lead_tags (tenant_id, name, slug, created_by)
             values ($1, $2, $2, $3)
             on conflict (tenant_id, slug) do update set updated_at = now()
             returning id`,
            [context.tenantId, slug, context.actorUserId],
          );
          await client.query(
            `insert into lead_tag_assignments (tenant_id, lead_id, tag_id, assigned_by)
             values ($1, $2, $3, $4)
             on conflict do nothing`,
            [context.tenantId, leadId, tagResult.rows[0].id, context.actorUserId],
          );
        }
        const after = await selectOne(client, context.tenantId, leadId, null, null);
        if (!after) throw new LeadsNotFoundError('Lead not found after tag update');
        await writeAudit(client, context, leadId, 'lead.tags_updated', before, after);
        await queueMetaStageEvent(client, context, after, 'tags_updated', before.stage);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async bulkSetLeadTags(context, leadIds, allowedStages, ownerUserId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const beforeParams = [context.tenantId, leadIds, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
        const beforeResult = await client.query(
          `${leadSelect}
            where l.tenant_id = $1 and l.id = any($2::uuid[])${stageClause(allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
            order by l.updated_at desc, l.created_at desc
            for update of l, c`,
          beforeParams,
        );
        const beforeLeads = beforeResult.rows.map(rowToLead);
        const visibleIds = beforeLeads.map((lead) => lead.id);
        if (visibleIds.length === 0) {
          await client.query('commit');
          return [];
        }
        await client.query('delete from lead_tag_assignments where tenant_id = $1 and lead_id = any($2::uuid[])', [context.tenantId, visibleIds]);
        for (const slug of input.tags) {
          const tagResult = await client.query(
            `insert into lead_tags (tenant_id, name, slug, created_by)
             values ($1, $2, $2, $3)
             on conflict (tenant_id, slug) do update set updated_at = now()
             returning id`,
            [context.tenantId, slug, context.actorUserId],
          );
          await client.query(
            `insert into lead_tag_assignments (tenant_id, lead_id, tag_id, assigned_by)
             select $1, unnest($2::uuid[]), $3, $4
             on conflict do nothing`,
            [context.tenantId, visibleIds, tagResult.rows[0].id, context.actorUserId],
          );
        }
        const afterResult = await client.query(
          `${leadSelect}
            where l.tenant_id = $1 and l.id = any($2::uuid[])
            order by l.updated_at desc, l.created_at desc`,
          [context.tenantId, visibleIds],
        );
        const afterLeads = afterResult.rows.map(rowToLead);
        const beforeById = new Map(beforeLeads.map((lead) => [lead.id, lead]));
        for (const after of afterLeads) {
          await writeAudit(client, context, after.id, 'lead.tags_updated', beforeById.get(after.id) ?? null, after);
          await queueMetaStageEvent(client, context, after, 'tags_updated', beforeById.get(after.id)?.stage ?? after.stage);
        }
        await client.query('commit');
        return afterLeads;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteLead(context, leadId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!before) throw new LeadsNotFoundError('Lead not found');
        await writeAudit(client, context, leadId, 'lead.deleted', before, null);
        await client.query('delete from leads where tenant_id = $1 and id = $2', [context.tenantId, leadId]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async bulkDeleteLeads(context, leadIds, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const beforeParams = [context.tenantId, leadIds, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
        const beforeResult = await client.query(
          `${leadSelect}
            where l.tenant_id = $1 and l.id = any($2::uuid[])${stageClause(allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
            order by l.updated_at desc, l.created_at desc
            for update of l, c`,
          beforeParams,
        );
        const beforeLeads = beforeResult.rows.map(rowToLead);
        const visibleIds = beforeLeads.map((lead) => lead.id);
        for (const before of beforeLeads) {
          await writeAudit(client, context, before.id, 'lead.deleted', before, null);
        }
        if (visibleIds.length > 0) {
          await client.query('delete from leads where tenant_id = $1 and id = any($2::uuid[])', [context.tenantId, visibleIds]);
        }
        await client.query('commit');
        return { deleted: visibleIds.length };
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async listLeadDocuments(tenantId, leadId, allowedStages, ownerUserId) {
      const params = [tenantId, leadId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
      const result = await pool.query(
        `${leadDocumentSelect}
          where d.tenant_id = $1 and d.lead_id = $2${stageClause(allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
          order by d.created_at desc`,
        params,
      );
      return result.rows.map(rowToLeadDocument);
    },

    async addLeadDocument(context, leadId, allowedStages, ownerUserId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const lead = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!lead) throw new LeadsNotFoundError('Lead not found');
        const fileData = input.fileData ?? null;
        const storageBackend = input.storageBackend ?? (fileData ? 'postgres' : 'external_url');
        const checksum = fileData ? createHash('sha256').update(fileData).digest('hex') : null;
        const inserted = await client.query(
          `insert into lead_documents (
             tenant_id, lead_id, file_name, mime_type, file_size, file_data, file_url,
             storage_backend, checksum_sha256, is_public, uploaded_by_user_id, uploaded_by_user_agent
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11)
           returning id,
                     tenant_id as "tenantId",
                     lead_id as "leadId",
                     file_name as "fileName",
                     mime_type as "mimeType",
                     file_size as "fileSize",
                     file_url as "fileUrl",
                     storage_backend as "storageBackend",
                     checksum_sha256 as "checksumSha256",
                     is_public as "isPublic",
                     uploaded_by_user_id as "uploadedByUserId",
                     uploaded_by_user_agent as "uploadedByUserAgent",
                     created_at::text as "createdAt",
                     updated_at::text as "updatedAt"`,
          [
            context.tenantId,
            leadId,
            input.fileName,
            input.mimeType ?? null,
            input.fileSize ?? fileData?.length ?? null,
            fileData,
            input.fileUrl ?? null,
            storageBackend,
            checksum,
            context.actorUserId,
            input.uploadedByUserAgent ?? context.userAgent ?? null,
          ],
        );
        const document = rowToLeadDocument(inserted.rows[0]);
        await writeLeadDocumentAudit(client, context, document.id, 'lead_document.uploaded', null, document);
        await client.query('commit');
        return document;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async getLeadDocumentContent(tenantId, leadId, documentId, allowedStages, ownerUserId) {
      const params = [tenantId, leadId, documentId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
      const result = await pool.query(
        `${leadDocumentContentSelect}
          where d.tenant_id = $1 and d.lead_id = $2 and d.id = $3${stageClause(allowedStages, 4)}${ownerClause(ownerUserId, 4 + stageParams(allowedStages).length)}
          limit 1`,
        params,
      );
      return result.rows[0] ? rowToLeadDocumentContent(result.rows[0]) : null;
    },

    async deleteLeadDocument(context, leadId, documentId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const params = [context.tenantId, leadId, documentId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)];
        const current = await client.query(
          `${leadDocumentSelect}
            where d.tenant_id = $1 and d.lead_id = $2 and d.id = $3${stageClause(allowedStages, 4)}${ownerClause(ownerUserId, 4 + stageParams(allowedStages).length)}
            for update of d`,
          params,
        );
        const document = current.rows[0] ? rowToLeadDocument(current.rows[0]) : null;
        if (!document) throw new LeadsNotFoundError('Document not found');
        await client.query('delete from lead_documents where tenant_id = $1 and lead_id = $2 and id = $3', [context.tenantId, leadId, documentId]);
        await writeLeadDocumentAudit(client, context, document.id, 'lead_document.deleted', document, null);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}
