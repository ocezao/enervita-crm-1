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
  priority: string;
  notes: string | null;
  lostReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contact: LeadContact;
  tags: LeadTag[];
};

export type LeadsRepository = {
  listLeads(tenantId: string, allowedStages: PipelineStageKey[] | null, filters?: LeadListFilters): Promise<Lead[]>;
  getLead(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null): Promise<Lead | null>;
  createLead(context: AuditContext, input: CreateLeadInput): Promise<Lead>;
  updateLead(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, input: UpdateLeadInput): Promise<Lead>;
  changeStage(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, targetStage: PipelineStageKey, notes?: string | null, lostReason?: string | null): Promise<Lead>;
  setLeadTags(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, input: SetLeadTagsInput): Promise<Lead>;
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
    priority: row.priority as string,
    notes: row.notes as string | null,
    lostReason: row.lostReason as string | null,
    metadata: jsonObject(row.metadata),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    tags: tagArray(row.tags),
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
                     left join lateral (
                       select jsonb_agg(jsonb_build_object('id', lt.id::text, 'name', lt.name, 'slug', lt.slug, 'color', lt.color) order by lt.name) as tags
                         from lead_tag_assignments lta
                         join lead_tags lt on lt.tenant_id = lta.tenant_id and lt.id = lta.tag_id
                        where lta.tenant_id = l.tenant_id and lta.lead_id = l.id
                     ) tag_rows on true`;

function stageClause(allowedStages: PipelineStageKey[] | null, offset: number): string {
  return allowedStages === null ? '' : ` and l.stage = any($${offset}::lead_stage[])`;
}

function stageParams(allowedStages: PipelineStageKey[] | null): unknown[] {
  return allowedStages === null ? [] : [allowedStages];
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

async function selectOne(client: PoolClient, tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, forUpdate = false): Promise<Lead | null> {
  const result = await client.query(
    `${leadSelect}
      where l.tenant_id = $1 and l.id = $2${stageClause(allowedStages, 3)}
      limit 1${forUpdate ? ' for update of l, c' : ''}`,
    [tenantId, leadId, ...stageParams(allowedStages)],
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

function crmSignalMetadata(lead: Lead, context: AuditContext): Record<string, unknown> {
  const leadMetadata = jsonObject(lead.metadata);
  const contactMetadata = jsonObject(lead.contact.metadata);
  const request = {
    clientIpAddress: firstString(context.ipAddress, nestedString(leadMetadata, ['request', 'clientIpAddress']), nestedString(contactMetadata, ['request', 'clientIpAddress'])),
    clientUserAgent: firstString(context.userAgent, nestedString(leadMetadata, ['request', 'clientUserAgent']), nestedString(contactMetadata, ['request', 'clientUserAgent']), nestedString(leadMetadata, ['request', 'userAgent']), nestedString(contactMetadata, ['request', 'userAgent'])),
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

async function queueMetaStageEvent(client: PoolClient, context: AuditContext, lead: Lead, action: 'created' | 'stage_changed' | 'tags_updated', fromStage?: PipelineStageKey | null): Promise<void> {
  const eventName = META_STAGE_EVENTS[lead.stage];
  if (!eventName) return;
  if (action === 'stage_changed' && fromStage === lead.stage) return;
  const payload = {
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
    estimatedTicket: lead.estimatedTicket,
    actorUserId: context.actorUserId,
    ...crmSignalMetadata(lead, context),
  };
  await client.query(
    `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
     values ($1, $2, 'meta', $3, 'queued', $4::jsonb, now())`,
    [context.tenantId, lead.id, eventName, JSON.stringify(payload)],
  );
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
    async listLeads(tenantId, allowedStages, filters) {
      const params = [tenantId, ...stageParams(allowedStages)];
      const tagFilter = tagFilterClause(filters, params.length + 1);
      const result = await pool.query(
        `${leadSelect}
          where l.tenant_id = $1${stageClause(allowedStages, 2)}${tagFilter.clause}
          order by l.updated_at desc, l.created_at desc`,
        [...params, ...tagFilter.params],
      );
      return result.rows.map(rowToLead);
    },
    async getLead(tenantId, leadId, allowedStages) {
      const client = await pool.connect();
      try {
        return await selectOne(client, tenantId, leadId, allowedStages);
      } finally {
        client.release();
      }
    },
    async createLead(context, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const contactId = await insertContact(client, context.tenantId, input.contact);
        const leadResult = await client.query(
          `insert into leads (tenant_id, contact_id, stage, qualification_status, lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbp, fbc, fbclid, gclid, estimated_ticket, sdr_owner_id, priority, notes, metadata)
           values ($1, $2, $3::lead_stage, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, coalesce($17::priority_level, 'media'), $18, coalesce($19::jsonb, '{}'::jsonb))
           returning id`,
          [context.tenantId, contactId, input.stage, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.utmContent ?? null, input.utmTerm ?? null, input.fbp ?? firstString(input.metadata?.fbp, nestedString(input.metadata, ['attribution', 'fbp']), input.contact.metadata?.fbp), input.fbc ?? firstString(input.metadata?.fbc, nestedString(input.metadata, ['attribution', 'fbc']), input.contact.metadata?.fbc), input.fbclid ?? firstString(input.metadata?.fbclid, nestedString(input.metadata, ['attribution', 'fbclid']), input.contact.metadata?.fbclid), input.gclid ?? firstString(input.metadata?.gclid, nestedString(input.metadata, ['attribution', 'gclid']), input.contact.metadata?.gclid), input.estimatedTicket ?? null, input.sdrOwnerId ?? null, input.priority ?? null, input.notes ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
        );
        const leadId = leadResult.rows[0].id as string;
        await client.query(
          `insert into lead_stage_history (tenant_id, lead_id, from_stage, to_stage, changed_by, notes)
           values ($1, $2, null, $3::lead_stage, $4, 'lead.created')`,
          [context.tenantId, leadId, input.stage, context.actorUserId],
        );
        const lead = await selectOne(client, context.tenantId, leadId, null);
        if (!lead) throw new LeadsNotFoundError('Lead not found after create');
        await writeAudit(client, context, leadId, 'lead.created', null, lead);
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
    async updateLead(context, leadId, allowedStages, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, true);
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
        const after = await selectOne(client, context.tenantId, leadId, null);
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
    async changeStage(context, leadId, allowedStages, targetStage, notes, lostReason) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, true);
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
        const after = await selectOne(client, context.tenantId, leadId, null);
        if (!after) throw new LeadsNotFoundError('Lead not found after stage change');
        await writeAudit(client, context, leadId, 'lead.stage_changed', before, after);
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

    async setLeadTags(context, leadId, allowedStages, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, leadId, allowedStages, true);
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
        const after = await selectOne(client, context.tenantId, leadId, null);
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
    async close() {
      await pool.end();
    },
  };
}
