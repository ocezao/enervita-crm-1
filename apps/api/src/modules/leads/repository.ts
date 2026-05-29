import pg, { type PoolClient } from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AuditContext } from '../users/repository.ts';
import type { ContactInput, CreateLeadInput, UpdateLeadInput } from './validation.ts';

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
  estimatedTicket: string | null;
  sdrOwnerId: string | null;
  priority: string;
  notes: string | null;
  lostReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contact: LeadContact;
};

export type LeadsRepository = {
  listLeads(tenantId: string, allowedStages: PipelineStageKey[] | null): Promise<Lead[]>;
  getLead(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null): Promise<Lead | null>;
  createLead(context: AuditContext, input: CreateLeadInput): Promise<Lead>;
  updateLead(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, input: UpdateLeadInput): Promise<Lead>;
  changeStage(context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, targetStage: PipelineStageKey, notes?: string | null, lostReason?: string | null): Promise<Lead>;
  countStageHistory?(tenantId: string, leadId: string): Promise<number>;
  close?(): Promise<void>;
};

export class LeadsNotFoundError extends Error {}
export class LeadsOperationError extends Error {}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
    estimatedTicket: row.estimatedTicket as string | null,
    sdrOwnerId: row.sdrOwnerId as string | null,
    priority: row.priority as string,
    notes: row.notes as string | null,
    lostReason: row.lostReason as string | null,
    metadata: jsonObject(row.metadata),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
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
                          c.updated_at::text as "contactUpdatedAt"
                     from leads l
                     join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id`;

function stageClause(allowedStages: PipelineStageKey[] | null, offset: number): string {
  return allowedStages === null ? '' : ` and l.stage = any($${offset}::lead_stage[])`;
}

function stageParams(allowedStages: PipelineStageKey[] | null): unknown[] {
  return allowedStages === null ? [] : [allowedStages];
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
    async listLeads(tenantId, allowedStages) {
      const result = await pool.query(
        `${leadSelect}
          where l.tenant_id = $1${stageClause(allowedStages, 2)}
          order by l.updated_at desc, l.created_at desc`,
        [tenantId, ...stageParams(allowedStages)],
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
          `insert into leads (tenant_id, contact_id, stage, qualification_status, lead_source, utm_source, utm_medium, utm_campaign, estimated_ticket, sdr_owner_id, priority, notes, metadata)
           values ($1, $2, $3::lead_stage, $4, $5, $6, $7, $8, $9, $10, coalesce($11::priority_level, 'media'), $12, coalesce($13::jsonb, '{}'::jsonb))
           returning id`,
          [context.tenantId, contactId, input.stage, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.estimatedTicket ?? null, input.sdrOwnerId ?? null, input.priority ?? null, input.notes ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
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
                  utm_medium = coalesce($6, utm_medium), utm_campaign = coalesce($7, utm_campaign), estimated_ticket = coalesce($8, estimated_ticket),
                  sdr_owner_id = coalesce($9, sdr_owner_id), priority = coalesce($10::priority_level, priority), notes = coalesce($11, notes),
                  lost_reason = coalesce($12, lost_reason), metadata = coalesce($13::jsonb, metadata), updated_at = now()
            where tenant_id = $1 and id = $2`,
          [context.tenantId, leadId, input.qualificationStatus ?? null, input.leadSource ?? null, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null, input.estimatedTicket ?? null, input.sdrOwnerId ?? null, input.priority ?? null, input.notes ?? null, input.lostReason ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
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
