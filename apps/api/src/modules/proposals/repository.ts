import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AuditContext } from '../users/repository.ts';
import type { ProposalInput, UpdateProposalInput } from './validation.ts';

const { Pool } = pg;

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'lost' | 'expired';
export type TrackingPlatform = 'site' | 'meta' | 'openpanel' | 'n8n' | 'ga4' | 'google_ads' | string;

export type Proposal = {
  id: string;
  tenantId: string;
  leadId: string;
  title: string;
  status: ProposalStatus;
  monthlyBillValue: number | null;
  estimatedKwh: number | null;
  discountPercentage: number | null;
  projectedMonthlySavings: number | null;
  projectedAnnualSavings: number | null;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  notes: string | null;
  sourceType: 'editor' | 'file';
  contentHtml: string | null;
  contentText: string | null;
  templateName: string | null;
  isTemplate: boolean;
  importedFileName: string | null;
  importedFileMimeType: string | null;
  importedFileSize: number | null;
  importedFileDataBase64: string | null;
  createdAt: string;
  updatedAt: string;
  leadName: string | null;
  leadStage: PipelineStageKey | null;
};

export type TrackingEventSummary = {
  id: string;
  tenantId: string;
  leadId: string | null;
  platform: TrackingPlatform;
  eventName: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  sentAt: string | null;
  nextRetryAt: string | null;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ProposalsRepository = {
  listProposals(tenantId: string, ownerUserId: string | null): Promise<Proposal[]>;
  listProposalsForLead(tenantId: string, leadId: string, ownerUserId: string | null): Promise<Proposal[]>;
  createProposal(context: AuditContext, input: ProposalInput, ownerUserId: string | null): Promise<Proposal>;
  getProposal(tenantId: string, proposalId: string): Promise<Proposal | null>;
  listTemplates(tenantId: string): Promise<Proposal[]>;
  updateProposal(context: AuditContext, proposalId: string, input: UpdateProposalInput): Promise<Proposal>;
  deleteProposal(context: AuditContext, proposalId: string): Promise<void>;
  listTrackingEventsForLead(tenantId: string, leadId: string, options?: { excludePlatforms?: string[]; ownerUserId?: string | null }): Promise<TrackingEventSummary[]>;
  close?(): Promise<void>;
};

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToProposal(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string,
    title: row.title as string,
    status: row.status as ProposalStatus,
    monthlyBillValue: numeric(row.monthlyBillValue),
    estimatedKwh: numeric(row.estimatedKwh),
    discountPercentage: numeric(row.discountPercentage),
    projectedMonthlySavings: numeric(row.projectedMonthlySavings),
    projectedAnnualSavings: numeric(row.projectedAnnualSavings),
    validUntil: row.validUntil as string | null,
    sentAt: row.sentAt as string | null,
    acceptedAt: row.acceptedAt as string | null,
    lostAt: row.lostAt as string | null,
    lostReason: row.lostReason as string | null,
    notes: row.notes as string | null,
    sourceType: (row.sourceType as 'editor' | 'file' | null) ?? 'editor',
    contentHtml: row.contentHtml as string | null,
    contentText: row.contentText as string | null,
    templateName: row.templateName as string | null,
    isTemplate: row.isTemplate === true,
    importedFileName: row.importedFileName as string | null,
    importedFileMimeType: row.importedFileMimeType as string | null,
    importedFileSize: numeric(row.importedFileSize),
    importedFileDataBase64: row.importedFileDataBase64 as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    leadName: row.leadName as string | null,
    leadStage: row.leadStage as PipelineStageKey | null,
  };
}

function rowToTrackingEvent(row: Record<string, unknown>): TrackingEventSummary {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string | null,
    platform: row.platform as string,
    eventName: row.eventName as string,
    status: row.status as 'queued' | 'sent' | 'failed',
    attempts: Number(row.attempts ?? 0),
    sentAt: row.sentAt as string | null,
    nextRetryAt: row.nextRetryAt as string | null,
    errorMessage: row.errorMessage as string | null,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt as string,
  };
}

const proposalTemplateSelect = `select p.id,
                               p.tenant_id as "tenantId",
                               p.lead_id as "leadId",
                               p.title,
                               p.status::text as status,
                               p.monthly_bill_value as "monthlyBillValue",
                               p.estimated_kwh as "estimatedKwh",
                               p.discount_percentage as "discountPercentage",
                               p.projected_monthly_savings as "projectedMonthlySavings",
                               p.projected_annual_savings as "projectedAnnualSavings",
                               p.valid_until::text as "validUntil",
                               p.sent_at::text as "sentAt",
                               p.accepted_at::text as "acceptedAt",
                               p.lost_at::text as "lostAt",
                               p.lost_reason as "lostReason",
                               p.notes,
                               p.source_type::text as "sourceType",
                               p.content_html as "contentHtml",
                               p.content_text as "contentText",
                               p.template_name as "templateName",
                               p.is_template as "isTemplate",
                               p.imported_file_name as "importedFileName",
                               p.imported_file_mime_type as "importedFileMimeType",
                               p.imported_file_size as "importedFileSize",
                               encode(p.imported_file_data, 'base64') as "importedFileDataBase64",
                               p.created_at::text as "createdAt",
                               p.updated_at::text as "updatedAt",
                               c.name as "leadName",
                               l.stage::text as "leadStage"
                          from proposals p
                          left join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
                          left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id`;

const proposalSelect = `select p.id,
                               p.tenant_id as "tenantId",
                               p.lead_id as "leadId",
                               p.title,
                               p.status::text as status,
                               p.monthly_bill_value as "monthlyBillValue",
                               p.estimated_kwh as "estimatedKwh",
                               p.discount_percentage as "discountPercentage",
                               p.projected_monthly_savings as "projectedMonthlySavings",
                               p.projected_annual_savings as "projectedAnnualSavings",
                               p.valid_until::text as "validUntil",
                               p.sent_at::text as "sentAt",
                               p.accepted_at::text as "acceptedAt",
                               p.lost_at::text as "lostAt",
                               p.lost_reason as "lostReason",
                               p.notes,
                               p.source_type::text as "sourceType",
                               p.content_html as "contentHtml",
                               p.content_text as "contentText",
                               p.template_name as "templateName",
                               p.is_template as "isTemplate",
                               p.imported_file_name as "importedFileName",
                               p.imported_file_mime_type as "importedFileMimeType",
                               p.imported_file_size as "importedFileSize",
                               encode(p.imported_file_data, 'base64') as "importedFileDataBase64",
                               p.created_at::text as "createdAt",
                               p.updated_at::text as "updatedAt",
                               c.name as "leadName",
                               l.stage::text as "leadStage"
                          from proposals p
                          join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
                          join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id`;


function ownerClause(ownerUserId: string | null | undefined, offset: number): string {
  return ownerUserId ? ` and l.sdr_owner_id = $${offset}::uuid` : '';
}

function ownerParams(ownerUserId: string | null | undefined): unknown[] {
  return ownerUserId ? [ownerUserId] : [];
}


async function writeAudit(client: pg.PoolClient, context: AuditContext, entityType: string, entityId: string, action: string, afterData: unknown): Promise<void> {
  await client.query(
    `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data, ip_address, user_agent)
     values ($1, $2, $3, $4, $5, $6::jsonb, nullif($7, '')::inet, $8)`,
    [context.tenantId, context.actorUserId, entityType, entityId, action, JSON.stringify(afterData), context.ipAddress ?? null, context.userAgent ?? null],
  );
}

export function createPgProposalsRepository(databaseUrl: string): ProposalsRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    async listProposals(tenantId, ownerUserId) {
      const result = await pool.query(`${proposalSelect} where p.tenant_id = $1${ownerClause(ownerUserId, 2)} order by p.created_at desc`, [tenantId, ...ownerParams(ownerUserId)]);
      return result.rows.map(rowToProposal);
    },
    async listProposalsForLead(tenantId, leadId, ownerUserId) {
      const result = await pool.query(`${proposalSelect} where p.tenant_id = $1 and p.lead_id = $2${ownerClause(ownerUserId, 3)} order by p.created_at desc`, [tenantId, leadId, ...ownerParams(ownerUserId)]);
      return result.rows.map(rowToProposal);
    },
    async getProposal(tenantId, proposalId) {
      const result = await pool.query(`${proposalTemplateSelect} where p.tenant_id = $1 and p.id = $2`, [tenantId, proposalId]);
      if (result.rows.length === 0) return null;
      return rowToProposal(result.rows[0]);
    },
    async listTemplates(tenantId) {
      const result = await pool.query(`${proposalTemplateSelect} where p.tenant_id = $1 and p.is_template = true order by p.created_at desc`, [tenantId]);
      return result.rows.map(rowToProposal);
    },
    async updateProposal(context, proposalId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const existing = await client.query('select id from proposals where tenant_id = $1 and id = $2', [context.tenantId, proposalId]);
        if (existing.rows.length === 0) throw new Error('Proposal not found');
        const sets: string[] = [];
        const params: unknown[] = [context.tenantId, proposalId];
        let idx = 3;
        const fieldMap: Record<string, string> = {
          title: 'title',
          status: 'status',
          monthlyBillValue: 'monthly_bill_value',
          estimatedKwh: 'estimated_kwh',
          discountPercentage: 'discount_percentage',
          projectedMonthlySavings: 'projected_monthly_savings',
          projectedAnnualSavings: 'projected_annual_savings',
          validUntil: 'valid_until',
          notes: 'notes',
          sourceType: 'source_type',
          contentHtml: 'content_html',
          contentText: 'content_text',
          templateName: 'template_name',
          isTemplate: 'is_template',
          leadId: 'lead_id',
        };
        for (const [key, col] of Object.entries(fieldMap)) {
          if ((input as Record<string, unknown>)[key] !== undefined) {
            sets.push(`${col} = $${idx}`);
            params.push((input as Record<string, unknown>)[key]);
            idx++;
          }
        }
        if (input.importedFile) {
          sets.push(`imported_file_name = $${idx}`, `imported_file_mime_type = $${idx + 1}`, `imported_file_size = $${idx + 2}`, `imported_file_data = $${idx + 3}`);
          params.push(input.importedFile.name, input.importedFile.mimeType, input.importedFile.size, input.importedFile.dataBase64 ? Buffer.from(input.importedFile.dataBase64, 'base64') : null);
          idx += 4;
        }
        if (sets.length > 0) {
          sets.push(`updated_at = now()`);
          await client.query(`update proposals set ${sets.join(', ')} where tenant_id = $1 and id = $2`, params);
        }
        const selected = await client.query(`${proposalTemplateSelect} where p.tenant_id = $1 and p.id = $2`, [context.tenantId, proposalId]);
        const proposal = rowToProposal(selected.rows[0]);
        if (proposal.status === 'accepted' && proposal.leadId) {
          await client.query(
            `update lead_opportunities
                set status = 'won', accepted_proposal_id = $3, accepted_at = coalesce(accepted_at, now()), updated_at = now()
              where tenant_id = $1 and lead_id = $2`,
            [context.tenantId, proposal.leadId, proposal.id],
          );
        }
        await writeAudit(client, context, 'proposal', proposal.id, proposal.status === 'accepted' ? 'proposal.accepted' : 'proposal.updated', proposal);
        await client.query('commit');
        return proposal;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteProposal(context, proposalId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const existing = await client.query('select id from proposals where tenant_id = $1 and id = $2', [context.tenantId, proposalId]);
        if (existing.rows.length === 0) throw new Error('Proposal not found');
        await client.query('delete from proposals where tenant_id = $1 and id = $2', [context.tenantId, proposalId]);
        await writeAudit(client, context, 'proposal', proposalId, 'proposal.deleted', { id: proposalId });
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async createProposal(context, input, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (ownerUserId) {
          const visible = await client.query('select 1 from leads l where l.tenant_id = $1 and l.id = $2 and l.sdr_owner_id = $3::uuid limit 1', [context.tenantId, input.leadId, ownerUserId]);
          if (visible.rowCount !== 1) throw new Error('Lead not found');
        }
        const importedFileBuffer = input.importedFile?.dataBase64 ? Buffer.from(input.importedFile.dataBase64, 'base64') : null;
        const inserted = await client.query(
          `insert into proposals (tenant_id, lead_id, title, status, monthly_bill_value, estimated_kwh, discount_percentage, projected_monthly_savings, projected_annual_savings, valid_until, notes, source_type, content_html, content_text, template_name, is_template, imported_file_name, imported_file_mime_type, imported_file_size, imported_file_data, created_by)
           values ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11::proposal_source_type, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           returning id`,
          [context.tenantId, input.leadId, input.title, input.monthlyBillValue, input.estimatedKwh ?? null, input.discountPercentage, input.projectedMonthlySavings, input.projectedAnnualSavings, input.validUntil ?? null, input.notes ?? null, input.sourceType, input.contentHtml ?? null, input.contentText ?? null, input.templateName ?? null, input.isTemplate, input.importedFile?.name ?? null, input.importedFile?.mimeType ?? null, input.importedFile?.size ?? null, importedFileBuffer, context.actorUserId],
        );
        const proposalId = inserted.rows[0].id as string;
        const selected = await client.query(`${proposalSelect} where p.tenant_id = $1 and p.id = $2`, [context.tenantId, proposalId]);
        const proposal = rowToProposal(selected.rows[0]);
        await writeAudit(client, context, 'proposal', proposal.id, 'proposal.created', proposal);
        await client.query('commit');
        return proposal;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async listTrackingEventsForLead(tenantId, leadId, options) {
      const excluded = options?.excludePlatforms ?? [];
      const result = await pool.query(
        `select id,
                tenant_id as "tenantId",
                lead_id as "leadId",
                platform,
                event_name as "eventName",
                status::text as status,
                attempts,
                sent_at::text as "sentAt",
                next_retry_at::text as "nextRetryAt",
                error_message as "errorMessage",
                payload,
                created_at::text as "createdAt"
           from tracking_events
          where tenant_id = $1 and lead_id = $2 and not (platform = any($3::text[]))
            and ($4::uuid is null or exists (select 1 from leads l where l.tenant_id = tracking_events.tenant_id and l.id = tracking_events.lead_id and l.sdr_owner_id = $4::uuid))
          order by created_at desc`,
        [tenantId, leadId, excluded, options?.ownerUserId ?? null],
      );
      return result.rows.map(rowToTrackingEvent);
    },
    async close() {
      await pool.end();
    },
  };
}
