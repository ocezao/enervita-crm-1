import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AuditContext } from '../users/repository.ts';
import type { ProposalInput } from './validation.ts';

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
    async createProposal(context, input, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (ownerUserId) {
          const visible = await client.query('select 1 from leads l where l.tenant_id = $1 and l.id = $2 and l.sdr_owner_id = $3::uuid limit 1', [context.tenantId, input.leadId, ownerUserId]);
          if (visible.rowCount !== 1) throw new Error('Lead not found');
        }
        const inserted = await client.query(
          `insert into proposals (tenant_id, lead_id, title, status, monthly_bill_value, estimated_kwh, discount_percentage, projected_monthly_savings, projected_annual_savings, valid_until, notes)
           values ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10)
           returning id`,
          [context.tenantId, input.leadId, input.title, input.monthlyBillValue, input.estimatedKwh ?? null, input.discountPercentage, input.projectedMonthlySavings, input.projectedAnnualSavings, input.validUntil ?? null, input.notes ?? null],
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
