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

export type LeadAttribution = {
  id: string;
  sourceSystem: string;
  sourceChannel: string;
  leadgenId: string | null;
  formId: string | null;
  formName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  confidence: string;
  metadata: Record<string, unknown>;
  lastReconciledAt: string;
};

export type Lead = {
  id: string;
  tenantId: string;
  contactId: string;
  stage: PipelineStageKey;
  pipelineKey?: string;
  pipelineStageKey?: string;
  pipelineStageLabel?: string | null;
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
  attribution?: LeadAttribution | null;
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
  changeStage(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, targetStage: PipelineStageKey, pipelineKey?: string | null, pipelineStageKey?: string | null, notes?: string | null, lostReason?: string | null, createOpportunity?: boolean): Promise<Lead>;
  setLeadTags(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: SetLeadTagsInput): Promise<Lead>;
  bulkSetLeadTags(context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: SetLeadTagsInput): Promise<Lead[]>;
  deleteLead(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<void>;
  bulkDeleteLeads(context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<{ deleted: number }>;
  listLeadDocuments(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<LeadDocument[]>;
  addLeadDocument(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: AddLeadDocumentInput): Promise<LeadDocument>;
  getLeadDocumentContent(tenantId: string, leadId: string, documentId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<LeadDocumentContent | null>;
  deleteLeadDocument(context: AuditContext, leadId: string, documentId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<void>;
  countStageHistory?(tenantId: string, leadId: string): Promise<number>;
  calculateQualificationScore?(tenantId: string, leadId: string, pipelineKey: string): Promise<{ score: number; factors: Record<string, number> } | null>;
    updateLeadOwner(tenantId: string, leadId: string, sdrOwnerId: string | null): Promise<Lead | null>;
  createAuditLog?(entry: { tenantId: string; actorUserId: string; entityType: string; entityId: string; action: string; beforeData?: any; afterData?: any; ipAddress?: string; userAgent?: string }): Promise<void>;
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

function rowToAttribution(value: unknown): LeadAttribution | null {
  const attribution = jsonObject(value);
  if (!attribution.id) return null;
  return {
    id: String(attribution.id),
    sourceSystem: String(attribution.sourceSystem ?? ''),
    sourceChannel: String(attribution.sourceChannel ?? ''),
    leadgenId: attribution.leadgenId ? String(attribution.leadgenId) : null,
    formId: attribution.formId ? String(attribution.formId) : null,
    formName: attribution.formName ? String(attribution.formName) : null,
    campaignId: attribution.campaignId ? String(attribution.campaignId) : null,
    campaignName: attribution.campaignName ? String(attribution.campaignName) : null,
    adsetId: attribution.adsetId ? String(attribution.adsetId) : null,
    adsetName: attribution.adsetName ? String(attribution.adsetName) : null,
    adId: attribution.adId ? String(attribution.adId) : null,
    adName: attribution.adName ? String(attribution.adName) : null,
    utmSource: attribution.utmSource ? String(attribution.utmSource) : null,
    utmMedium: attribution.utmMedium ? String(attribution.utmMedium) : null,
    utmCampaign: attribution.utmCampaign ? String(attribution.utmCampaign) : null,
    utmContent: attribution.utmContent ? String(attribution.utmContent) : null,
    utmTerm: attribution.utmTerm ? String(attribution.utmTerm) : null,
    fbclid: attribution.fbclid ? String(attribution.fbclid) : null,
    gclid: attribution.gclid ? String(attribution.gclid) : null,
    confidence: String(attribution.confidence ?? 'partial'),
    metadata: jsonObject(attribution.metadata),
    lastReconciledAt: String(attribution.lastReconciledAt ?? ''),
  };
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    contactId: row.contactId as string,
    stage: row.stage as PipelineStageKey,
    pipelineKey: (row.pipelineKey as string | null) ?? 'geral',
    pipelineStageKey: (row.pipelineStageKey as string | null) ?? (row.stage as string),
    pipelineStageLabel: (row.pipelineStageLabel as string | null) ?? null,
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
    attribution: rowToAttribution(row.attribution),
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
                          l.pipeline_key as "pipelineKey",
                          l.pipeline_stage_key as "pipelineStageKey",
                          pipeline_stage.label as "pipelineStageLabel",
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
                            coalesce(tag_rows.tags, '[]'::jsonb) as tags,
                            attribution_row.attribution
                     from leads l
                     join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
                     left join lead_pipeline_stages pipeline_stage
                       on pipeline_stage.tenant_id = l.tenant_id
                      and pipeline_stage.pipeline_key = l.pipeline_key
                      and pipeline_stage.key = l.pipeline_stage_key
                       left join users owner_user on owner_user.tenant_id = l.tenant_id and owner_user.id = l.sdr_owner_id
                       left join lead_opportunities lo on lo.tenant_id = l.tenant_id and lo.lead_id = l.id
                       left join lateral (
                         select jsonb_agg(jsonb_build_object('id', lt.id::text, 'name', lt.name, 'slug', lt.slug, 'color', lt.color) order by lt.name) as tags
                           from lead_tag_assignments lta
                           join lead_tags lt on lt.tenant_id = lta.tenant_id and lt.id = lta.tag_id
                          where lta.tenant_id = l.tenant_id and lta.lead_id = l.id
                       ) tag_rows on true
                       left join lateral (
                         select jsonb_build_object(
                                  'id', la.id::text,
                                  'sourceSystem', la.source_system,
                                  'sourceChannel', la.source_channel,
                                  'leadgenId', la.leadgen_id,
                                  'formId', la.form_id,
                                  'formName', la.form_name,
                                  'campaignId', la.campaign_id,
                                  'campaignName', la.campaign_name,
                                  'adsetId', la.adset_id,
                                  'adsetName', la.adset_name,
                                  'adId', la.ad_id,
                                  'adName', la.ad_name,
                                  'utmSource', la.utm_source,
                                  'utmMedium', la.utm_medium,
                                  'utmCampaign', la.utm_campaign,
                                  'utmContent', la.utm_content,
                                  'utmTerm', la.utm_term,
                                  'fbclid', la.fbclid,
                                  'gclid', la.gclid,
                                  'confidence', la.confidence,
                                  'metadata', la.metadata,
                                  'lastReconciledAt', la.last_reconciled_at::text
                                ) as attribution
                           from lead_attributions la
                          where la.tenant_id = l.tenant_id and la.lead_id = l.id
                          limit 1
                       ) attribution_row on true`;

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
  return ownerUserId === null ? '' : ` and l.sdr_owner_id = $${offset}::uuid`;
}

function ownerParams(ownerUserId: string | null): unknown[] {
  return ownerUserId === null ? [] : [ownerUserId];
}

function pipelineClause(filters: LeadListFilters | undefined, offset: number): { clause: string; params: unknown[] } {
  return filters?.pipelineKey ? { clause: ` and l.pipeline_key = $${offset}`, params: [filters.pipelineKey] } : { clause: '', params: [] };
}

async function resolvePipelineStage(client: PoolClient, tenantId: string, pipelineKey?: string | null, pipelineStageKey?: string | null, fallbackStage: PipelineStageKey = 'novo_lead'): Promise<{ pipelineKey: string; pipelineStageKey: string; legacyStage: PipelineStageKey }> {
  const normalizedPipelineKey = pipelineKey || 'geral';
  const normalizedStageKey = pipelineStageKey || fallbackStage;
  const result = await client.query(
    `select pipeline_key, key, legacy_stage::text as "legacyStage"
       from lead_pipeline_stages
      where tenant_id = $1
        and pipeline_key = $2
        and key = $3
      limit 1`,
    [tenantId, normalizedPipelineKey, normalizedStageKey],
  );
  const row = result.rows[0];
  if (row) {
    return { pipelineKey: row.pipeline_key, pipelineStageKey: row.key, legacyStage: row.legacyStage as PipelineStageKey };
  }
  return { pipelineKey: 'geral', pipelineStageKey: fallbackStage, legacyStage: fallbackStage };
}



const SERVICE_MAPPINGS: Record<string, string[]> = {
  assinatura: [
    'ASSINATURA', 'ASSINATURAS', 'ASS', 'ASSIN',
    'CONSORCIO', 'CONSORCIO/ASSINATURA',
    'ENERGIAASS', 'ENERGIA ASSINATURA', 'ENERGIA/ASSINATURA',
    'RESIDENCIAL-ASSINATURA', 'RESIDENCIAL ASSINATURA',
    'SOLAR POR ASSINATURA', 'ENERGIA POR ASSINATURA',
    'CONSORCIOS', 'ASSINATURA SOLAR', 'ASSINATURA ENERGIA',
  ],
  solar_proprio: [
    'PLACAS SOLARES', 'PLACAS', 'SOLAR', 'PAINEL', 'PAINEL SOLAR',
    'SISTEMA PROPRIO', 'SISTEMA PRÓPRIO', 'FOTOVOLTAICO', 'FOTOVOLTAICA',
    'INSTALACAO', 'INSTALACAO SOLAR', 'INSTALAÇÃO',
    'ENERGIA SOLAR', 'SOLAR PROPRIO', 'ENERGIA FOTOVOLTAICA',
    'PAINEL SOLAR', 'PLACAS SOLARES',
  ],
  bateria_backup: [
    'BATERIAS', 'BATERIA', 'BACKUP', 'ARMAZENAMENTO', 'NOBREAK',
    'BATERIA SOLAR', 'ENERGIA ARMAZENADA', 'BATERIA BACKUP',
    'BATERIAS SOLAR', 'BATERIAS SOLARES',
    'ARMAZENAMENTO DE ENERGIA', 'BACKUP DE ENERGIA',
  ],
  usina: [
    'USINA', 'USINAS', 'USINA SOLAR', 'INVESTIMENTO EM USINA',
    'FAZENDA SOLAR', 'EMPRESAS', 'EMPRESA', 'COMERCIAL', 'INDUSTRIAL',
    'GERACAO', 'GERAÇÃO', 'GRANDE PORTE',
    'USINA FOTOVOLTAICA', 'PARQUE SOLAR',
  ],
  clube_enervita: [
    'CLUBE ENERVITA', 'CLUBE', 'ENERGIA CLUB', 'CLUBE SOLAR',
    'CLUBE DE ENERGIA', 'MEMBRO', 'ASSOCIADO',
  ],
  indicacao: [
    'INDICACAO', 'INDICAÇÃO', 'INDIQUE', 'REFERENCIA', 'REFERÊNCIA',
    'REFERRAL', 'INDICADO', 'INDICACAO DE AMIGO',
    'INDICAÇÃO DE AMIGO', 'INDICACAO AMIGO',
  ],
};

async function detectLeadService(client: PoolClient, tenantId: string, leadId: string): Promise<string | null> {
  // Buscar form_name do lead
  const result = await client.query(
    'SELECT form_name FROM lead_attributions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1',
    [leadId]
  );
  
  if (result.rows.length === 0 || !result.rows[0].form_name) return null;
  
  const formName = result.rows[0].form_name.toUpperCase();
  
  // Buscar servicos e suas keywords
  const services = await client.query(
    'SELECT key, keywords FROM lead_routing_services WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  );
  
  // Match form_name com keywords
  for (const service of services.rows) {
    const keywords = service.keywords;
    const keywordsList = Array.isArray(keywords) ? keywords : [];
    for (const keyword of keywordsList) {
      if (formName.includes(keyword.toUpperCase())) {
        return service.key;
      }
    }
  }
  
  // Fallback: match direto por palavras-chave conhecidas
  const directMappings: Record<string, string> = {
    'ASSINATURA': 'assinatura',
    'CONSORCIO': 'assinatura',
    'ENERGIAASS': 'assinatura',
    'PLACAS': 'solar_proprio',
    'SOLAR': 'solar_proprio',
    'PAINEL': 'solar_proprio',
    'FOTOVOLTAICO': 'solar_proprio',
    'BATERIA': 'bateria_backup',
    'BACKUP': 'bateria_backup',
    'NOBREAK': 'bateria_backup',
    'USINA': 'usina',
    'INVESTIMENTO': 'usina',
    'FAZENDA': 'usina',
    'CLUBE': 'clube_enervita',
    'INDICACAO': 'indicacao',
    'REFERENCIA': 'indicacao',
    'REFERRAL': 'indicacao',
    'EMPRESA': 'usina',
    'COMERCIAL': 'usina',
    'INDUSTRIAL': 'usina',
  };
  
  for (const [keyword, serviceKey] of Object.entries(directMappings)) {
    if (formName.includes(keyword)) {
      return serviceKey;
    }
  }
  
  return null;
}

async function resolveUserByService(client: PoolClient, tenantId: string, serviceKey: string): Promise<string | null> {
  // Buscar assignment do servico
  const result = await client.query(
    "SELECT user_id FROM lead_routing_rule_assignments WHERE tenant_id = $1 AND rule_key = 'by_service' AND config->>'serviceKey' = $2",
    [tenantId, serviceKey]
  );
  
  if (result.rows.length > 0) return result.rows[0].user_id;
  
  return null;
}

async function resolveSdrOwnerId(client: PoolClient, tenantId: string, requestedOwnerId?: string | null, leadData?: { priority?: string; metadata?: Record<string, unknown> }): Promise<string | null> {
  if (requestedOwnerId) return requestedOwnerId;

  // Buscar regra ativa com menor prioridade
  const activeRule = await client.query(
    `SELECT rule_key FROM lead_routing_rules 
     WHERE tenant_id = $1 AND is_active = true 
     ORDER BY priority ASC LIMIT 1`,
    [tenantId]
  );

  const ruleKey = activeRule.rows[0]?.rule_key ?? 'round_robin';

  // Buscar usuários elegíveis (não-admin, role comercial)
  const eligibleQuery = `
    SELECT u.id::text as id, u.name,
           (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = u.tenant_id AND l.sdr_owner_id = u.id) as lead_count
    FROM users u
    JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
    JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
    WHERE u.tenant_id = $1
      AND u.status = 'active'
      AND r.name IN ('sdr', 'vendedor', 'seller', 'closer', 'consultor')
      AND NOT EXISTS (
        SELECT 1 FROM user_roles admin_ur
        JOIN roles admin_r ON admin_r.tenant_id = admin_ur.tenant_id AND admin_r.id = admin_ur.role_id
        WHERE admin_ur.tenant_id = u.tenant_id AND admin_ur.user_id = u.id AND admin_r.name = 'admin'
      )
    GROUP BY u.id, u.name
    ORDER BY lead_count ASC, u.name ASC, u.id ASC`;

  const eligibleUsers = await client.query(eligibleQuery, [tenantId]);

  if (eligibleUsers.rows.length === 0) return null;

  // Aplicar regra
  switch (ruleKey) {
    case 'round_robin': {
      // Menor quantidade de leads (já ordenado pela query)
      return eligibleUsers.rows[0].id;
    }

    case 'random': {
      // Aleatório entre elegíveis
      const randomIndex = Math.floor(Math.random() * eligibleUsers.rows.length);
      return eligibleUsers.rows[randomIndex].id;
    }

    case 'manual': {
      // Não atribuir — admin faz manualmente
      return null;
    }

    case 'by_service': {
      // Detectar servico do lead
      const serviceKey = leadData?.leadId ? await detectLeadService(client, tenantId, leadData.leadId) : null;
      
      if (serviceKey) {
        // Buscar vendedor atribuido ao servico
        const assignedUser = await resolveUserByService(client, tenantId, serviceKey);
        if (assignedUser) return assignedUser;
      }
      
      // Fallback: round-robin
      return eligibleUsers.rows[0].id;
    }

    case 'by_priority': {
      // TODO: filtrar por prioridade do lead
      // Por enquanto, fallback para round-robin
      return eligibleUsers.rows[0].id;
    }

    case 'by_bill_value': {
      // TODO: filtrar por valor da conta
      // Por enquanto, fallback para round-robin
      return eligibleUsers.rows[0].id;
    }

    default: {
      // Fallback: menor contagem de leads
      return eligibleUsers.rows[0].id;
    }
  }
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

// FASE 1: Funções auxiliares para bloqueio de retrocesso
async function loadPipelineRules(client: PoolClient, tenantId: string, pipelineKey: string) {
  const result = await client.query(
    'SELECT * FROM pipeline_rules_config WHERE tenant_id = $1 AND pipeline_key = $2',
    [tenantId, pipelineKey]
  );
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  return {
    block_backward_movement: true,
    allowed_backward_roles: ['admin', 'manager'],
    require_notes_on_backward: true,
    lead_stale_warn_hours: 24,
    lead_stale_critical_hours: 72,
    lead_stale_escalation_hours: 168,
    seller_inactive_warn_hours: 48,
    admin_alert_threshold_hours: 48,
    admin_alert_min_leads: 1,
  };
}

async function getUserRole(client: PoolClient, tenantId: string, userId: string): Promise<string> {
  const result = await client.query(
    'SELECT r.name FROM roles r JOIN user_roles ur ON ur.tenant_id = r.tenant_id AND ur.role_id = r.id WHERE ur.tenant_id = $1 AND ur.user_id = $2 LIMIT 1',
    [tenantId, userId]
  );
  return result.rows[0]?.name || 'user';
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
      const pipelineFilter = pipelineClause(filters, baseParams.length + 1);
      const tagFilter = tagFilterClause(filters, baseParams.length + pipelineFilter.params.length + 1);
      const result = await pool.query(
        `${leadSelect}
          where l.tenant_id = $1${stageClause(allowedStages, 2)}${ownerClause(ownerUserId, 2 + stageParams(allowedStages).length)}${pipelineFilter.clause}${tagFilter.clause}
          order by l.updated_at desc, l.created_at desc`,
        [...baseParams, ...pipelineFilter.params, ...tagFilter.params],
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

    // FASE 4: Score de qualificação do lead
    async calculateQualificationScore(tenantId: string, leadId: string, pipelineKey: string) {
      const client = await pool.connect();
      try {
        const lead = await client.query(
          `select l.id, l.stage, l.estimated_ticket, l.updated_at, l.created_at, l.metadata,
                  c.name, c.email, c.phone, c.company, c.metadata as "contactMetadata"
             from leads l
             join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
            where l.tenant_id = $1 and l.id = $2`,
          [tenantId, leadId],
        );
        if (lead.rows.length === 0) return null;

        const d = lead.rows[0];
        const factors: Record<string, number> = {};
        let total = 0;

        // FIT (max 25)
        let fit = 0;
        if (d.name && d.phone && d.email) fit += 10;
        if (d.company) fit += 5;
        if (d.email && !/@(gmail|yahoo|hotmail|outlook)\./i.test(d.email)) fit += 5;
        if (d.phone && /^\+?[\d\s-]{10,}$/.test(d.phone)) fit += 5;
        factors.fit = fit;
        total += fit;

        // INTENT (max 30)
        let intent = 0;
        const meta = d.metadata || {};
        const cmeta = d.contactMetadata || {};
        if (meta.interest || meta.product_interest || cmeta.interest) intent += 10;
        if (d.estimated_ticket && parseFloat(d.estimated_ticket) > 0) intent += 15;
        if (meta.budget_defined || cmeta.budget) intent += 5;
        factors.intent = intent;
        total += intent;

        // BEHAVIOR (max 25)
        let behavior = 0;
        const hoursInStage = (Date.now() - new Date(d.updated_at).getTime()) / 3600000;
        if (hoursInStage < 24) behavior += 15;
        else if (hoursInStage < 72) behavior += 10;
        else if (hoursInStage < 168) behavior += 5;
        if (meta.meetings_scheduled > 0 || meta.responses_count > 0) behavior += 5;
        if (d.stage !== 'novo_lead') behavior += 5;
        factors.behavior = behavior;
        total += behavior;

        // NEGATIVE (max -15)
        let negative = 0;
        if (meta.unsubscribed || cmeta.unsubscribed) negative -= 10;
        if (hoursInStage > 168) negative -= 5;
        factors.negative = negative;
        total += negative;

        total = Math.max(0, Math.min(100, total));

        await client.query(
          `insert into lead_qualification_scores (tenant_id, lead_id, pipeline_key, score, max_score, factors)
           values ($1, $2, $3, $4, 100, $5::jsonb)
           on conflict (tenant_id, lead_id, pipeline_key)
           do update set score = $4, factors = $5::jsonb, calculated_at = now(), expires_at = now() + interval '7 days'`,
          [tenantId, leadId, pipelineKey || 'geral', total, JSON.stringify(factors)],
        );

        // FASE 5: Enviar score para Meta Ads
        try {
          const metaPayload = {
            leadId,
            stage: d.stage,
            qualificationScore: total,
            leadEventSource: 'Enervita Custom CRM',
          };
          await client.query(
            `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload)
             values ($1, $2, 'meta', 'EnervitaQualificationScore', 'queued', $3::jsonb)`,
            [tenantId, leadId, JSON.stringify(metaPayload)],
          );
        } catch {
          // Não falhar o cálculo do score se o Meta event falhar
        }

        return { score: total, factors };
      } finally {
        client.release();
      }
    },

    async createLead(context, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const contactId = await insertContact(client, context.tenantId, input.contact);
        const sdrOwnerId = await resolveSdrOwnerId(client, context.tenantId, input.sdrOwnerId, { priority: input.priority ?? undefined, metadata: input.metadata ?? undefined, leadId: leadId });
        const pipeline = await resolvePipelineStage(client, context.tenantId, input.pipelineKey, input.pipelineStageKey, input.stage);
        const leadResult = await client.query(
          `insert into leads (tenant_id, contact_id, stage, pipeline_key, pipeline_stage_key, qualification_status, lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbp, fbc, fbclid, gclid, estimated_ticket, sdr_owner_id, priority, notes, metadata)
           values ($1, $2, $3::lead_stage, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, coalesce($19::priority_level, 'media'), $20, coalesce($21::jsonb, '{}'::jsonb))
           returning id`,
          [context.tenantId, contactId, pipeline.legacyStage, pipeline.pipelineKey, pipeline.pipelineStageKey, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.utmContent ?? null, input.utmTerm ?? null, input.fbp ?? firstString(input.metadata?.fbp, nestedString(input.metadata, ['attribution', 'fbp']), input.contact.metadata?.fbp), input.fbc ?? firstString(input.metadata?.fbc, nestedString(input.metadata, ['attribution', 'fbc']), input.contact.metadata?.fbc), input.fbclid ?? firstString(input.metadata?.fbclid, nestedString(input.metadata, ['attribution', 'fbclid']), input.contact.metadata?.fbclid), input.gclid ?? firstString(input.metadata?.gclid, nestedString(input.metadata, ['attribution', 'gclid']), input.contact.metadata?.gclid), input.estimatedTicket ?? null, sdrOwnerId, input.priority ?? null, input.notes ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
        );
        const leadId = leadResult.rows[0].id as string;
        await client.query(
          `insert into lead_stage_history (tenant_id, lead_id, from_stage, to_stage, changed_by, notes)
           values ($1, $2, null, $3::lead_stage, $4, 'lead.created')`,
          [context.tenantId, leadId, pipeline.legacyStage, context.actorUserId],
        );
        const lead = await selectOne(client, context.tenantId, leadId, null, null);
        if (!lead) throw new LeadsNotFoundError('Lead not found after create');
        await writeAudit(client, context, leadId, 'lead.created', null, lead);
        if (sdrOwnerId) await writeAudit(client, context, leadId, 'lead.assigned', null, lead);
        await queueMetaStageEvent(client, context, lead, 'created', null);
        await client.query('commit');
        // FASE 4: Calcular score após criar lead (async, não bloqueia)
        this.calculateQualificationScore(context.tenantId, leadId, pipeline.pipelineKey).catch(() => {});
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
    async changeStage(context, leadId, allowedStages, ownerUserId, targetStage, pipelineKey = null, pipelineStageKey = null, notes = null, lostReason = null, createOpportunity = false) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, ownerUserId, true);
        if (!before) throw new LeadsNotFoundError('Lead not found');
        const pipeline = await resolvePipelineStage(client, context.tenantId, pipelineKey ?? before.pipelineKey, pipelineStageKey, targetStage);

        // FASE 1: Bloqueio de retrocesso
        const rulesConfig = await loadPipelineRules(client, context.tenantId, before.pipelineKey || 'geral');
        const currentOrder = META_STAGE_ORDER[before.stage as PipelineStageKey] || 0;
        const targetOrder = META_STAGE_ORDER[pipeline.legacyStage as PipelineStageKey] || 0;
        const isBackward = targetOrder < currentOrder;

        if (isBackward && rulesConfig.block_backward_movement) {
          const userRole = await getUserRole(client, context.tenantId, context.actorUserId);
          const allowedRoles = Array.isArray(rulesConfig.allowed_backward_roles) ? rulesConfig.allowed_backward_roles : ['admin', 'manager'];

          if (!allowedRoles.includes(userRole)) {
            await client.query(
              `INSERT INTO lead_stage_transitions (tenant_id, lead_id, pipeline_key, from_stage, to_stage, direction, changed_by, blocked, block_reason) VALUES ($1, $2, $3, $4, $5, 'backward', $6, true, $7)`,
              [context.tenantId, leadId, before.pipelineKey || 'geral', before.stage, pipeline.legacyStage, context.actorUserId, `Role '${userRole}' nao pode mover para tras`]
            );
            await client.query('commit');
            throw new LeadsOperationError(`Vendedores nao podem mover leads para estagios anteriores. Estagio atual: ${before.stage}, Tentativa: ${pipeline.legacyStage}. Entre em contato com um administrador.`);
          }

          if (rulesConfig.require_notes_on_backward && !notes) {
            await client.query('commit');
            throw new LeadsOperationError(`Ao mover um lead para tras, e obrigatorio informar o motivo nas notas.`);
          }
        }

        await client.query(
          `update leads
              set stage = $3::lead_stage,
                  pipeline_key = $4,
                  pipeline_stage_key = $5,
                  lost_reason = coalesce($6, lost_reason),
                  updated_at = now()
            where tenant_id = $1 and id = $2`,
          [context.tenantId, leadId, pipeline.legacyStage, pipeline.pipelineKey, pipeline.pipelineStageKey, lostReason ?? null],
        );
        await client.query(
          `insert into lead_stage_history (tenant_id, lead_id, from_stage, to_stage, changed_by, notes)
           values ($1, $2, $3::lead_stage, $4::lead_stage, $5, $6)`,
          [context.tenantId, leadId, before.stage, pipeline.legacyStage, context.actorUserId, notes ?? null],
        );

        // FASE 1: Registrar transicao bem-sucedida
        const direction = isBackward ? 'backward' : (targetOrder > currentOrder ? 'forward' : 'lateral');
        await client.query(
          `INSERT INTO lead_stage_transitions (tenant_id, lead_id, pipeline_key, from_stage, to_stage, direction, changed_by, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [context.tenantId, leadId, before.pipelineKey || 'geral', before.stage, pipeline.legacyStage, direction, context.actorUserId, notes ?? null]
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
        // FASE 4: Recalcular score após mudança de estágio
        this.calculateQualificationScore(context.tenantId, leadId, pipeline.pipelineKey).catch(() => {});
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

    
    async updateLeadOwner(tenantId: string, leadId: string, sdrOwnerId: string | null) {
      const result = await pool.query(
        `UPDATE leads
         SET sdr_owner_id = $3, updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING *`,
        [tenantId, leadId, sdrOwnerId],
      );
      if (result.rowCount === 0) return null;
      return rowToLead(result.rows[0]);
    },
    async createAuditLog(entry) {
      await pool.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.tenantId,
          entry.actorUserId,
          entry.entityType,
          entry.entityId,
          entry.action,
          entry.beforeData ? JSON.stringify(entry.beforeData) : null,
          entry.afterData ? JSON.stringify(entry.afterData) : null,
          entry.ipAddress || null,
          entry.userAgent || null,
        ]
      );
    },
    async close() {
      await pool.end();
    },
  };
}
