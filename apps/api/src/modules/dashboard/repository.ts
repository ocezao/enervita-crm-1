import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { Activity, ActivityType } from '../engagement/repository.ts';

const { Pool } = pg;

export type DashboardCount = { count: number };
export type LeadsBySource = { source: string; count: number };
export type LeadsByStage = { stage: PipelineStageKey; count: number };
export type ConversionsByPlatform = { platform: string; count: number };

export type CommercialStageBreakdown = {
  stage: PipelineStageKey;
  count: number;
  value: number;
};

export type CommercialAttentionLead = {
  id: string;
  name: string;
  stage: PipelineStageKey;
  reason: string;
  updatedAt: string;
  nextActionAt: string | null;
};

export type CommercialMetrics = {
  openOpportunityValue: number;
  wonOpportunityValue: number;
  openOpportunities: number;
  wonOpportunities: number;
  openProposals: number;
  acceptedProposals: number;
  acceptedProposalAnnualValue: number;
  overdueTasks: number;
  leadsWithoutNextAction: number;
  staleLeads: number;
  stageBreakdown: CommercialStageBreakdown[];
  attentionLeads: CommercialAttentionLead[];
};

export type DashboardMetrics = {
  newLeadsToday: number;
  leadsWithoutFollowup: number;
  overdueTasks: number;
  openProposals: number;
  leadsBySource: LeadsBySource[];
  leadsByStage: LeadsByStage[];
  conversionsByPlatform: ConversionsByPlatform[];
  recentEvents: Activity[];
  commercial: CommercialMetrics;
};

export type DashboardRepository = {
  getMetrics(tenantId: string, allowedStages: PipelineStageKey[] | null): Promise<DashboardMetrics>;
  close?(): Promise<void>;
};

function stageClause(alias: string, allowedStages: PipelineStageKey[] | null, offset: number): string {
  if (allowedStages === null) return '';
  return ` and ${alias}.stage = any($${offset}::lead_stage[])`;
}

function stageParams(allowedStages: PipelineStageKey[] | null): unknown[] {
  return allowedStages === null ? [] : [allowedStages];
}

function countValue(row: Record<string, unknown> | undefined): number {
  const raw = row?.count;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return Number(raw);
  return 0;
}

function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string,
    contactId: row.contactId as string | null,
    userId: row.userId as string | null,
    activityType: row.activityType as ActivityType,
    outcome: row.outcome as string,
    responseTimeSeconds: row.responseTimeSeconds as number | null,
    notes: row.notes as string | null,
    occurredAt: row.occurredAt as string,
    createdAt: row.createdAt as string,
    leadStage: row.leadStage as PipelineStageKey | null,
  };
}


function numericValue(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function intValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getCommercialMetrics(pool: pg.Pool, tenantId: string, allowedStages: PipelineStageKey[] | null): Promise<CommercialMetrics> {
  const stageFilter = allowedStages === null ? '' : 'and l.stage = any($2::lead_stage[])';
  const params = allowedStages === null ? [tenantId] : [tenantId, allowedStages];

  const opportunityResult = await pool.query(
    `select
        coalesce(sum(expected_value) filter (where status = 'open'), 0)::text as "openValue",
        coalesce(sum(expected_value) filter (where status = 'won'), 0)::text as "wonValue",
        count(*) filter (where status = 'open')::int as "openCount",
        count(*) filter (where status = 'won')::int as "wonCount"
       from lead_opportunities lo
       join leads l on l.tenant_id = lo.tenant_id and l.id = lo.lead_id
      where lo.tenant_id = $1 ${stageFilter}`,
    params,
  );

  const proposalResult = await pool.query(
    `select
        count(*) filter (where p.status in ('draft', 'sent'))::int as "openProposals",
        count(*) filter (where p.status = 'accepted')::int as "acceptedProposals",
        coalesce(sum(p.projected_annual_savings) filter (where p.status = 'accepted'), 0)::text as "acceptedAnnualValue"
       from proposals p
       join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
      where p.tenant_id = $1 ${stageFilter}`,
    params,
  );

  const taskResult = await pool.query(
    `select count(*)::int as count
       from tasks t
       join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id
      where t.tenant_id = $1
        and t.status not in ('concluido', 'cancelado')
        and t.due_date < now()
        ${stageFilter}`,
    params,
  );

  const staleResult = await pool.query(
    `select
        count(*) filter (where l.next_action_at is null and l.stage <> 'perdido')::int as "withoutNextAction",
        count(*) filter (where l.updated_at < now() - interval '7 days' and l.stage not in ('perdido', 'contrato_enervita'))::int as "staleLeads"
       from leads l
      where l.tenant_id = $1 ${stageFilter}`,
    params,
  );

  const stageResult = await pool.query(
    `select l.stage::text as stage,
            count(*)::int as count,
            coalesce(sum(lo.expected_value), 0)::text as value
       from leads l
       left join lead_opportunities lo on lo.tenant_id = l.tenant_id and lo.lead_id = l.id and lo.status = 'open'
      where l.tenant_id = $1 ${stageFilter}
      group by l.stage
      order by min(l.updated_at) asc`,
    params,
  );

  const attentionResult = await pool.query(
    `select l.id,
            c.name,
            l.stage::text as stage,
            case
              when exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 'Tarefa vencida'
              when l.next_action_at is null then 'Sem próxima ação'
              when l.updated_at < now() - interval '7 days' then 'Lead parado'
              else 'Revisar'
            end as reason,
            l.updated_at::text as "updatedAt",
            l.next_action_at::text as "nextActionAt"
       from leads l
       join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
      where l.tenant_id = $1
        ${stageFilter}
        and l.stage not in ('perdido', 'contrato_enervita')
        and (
          l.next_action_at is null
          or l.updated_at < now() - interval '7 days'
          or exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now())
        )
      order by
        case
          when exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 1
          when l.next_action_at is null then 2
          else 3
        end,
        l.updated_at asc
      limit 8`,
    params,
  );

  const opportunities = opportunityResult.rows[0] ?? {};
  const proposals = proposalResult.rows[0] ?? {};
  const stale = staleResult.rows[0] ?? {};

  return {
    openOpportunityValue: numericValue(opportunities.openValue),
    wonOpportunityValue: numericValue(opportunities.wonValue),
    openOpportunities: intValue(opportunities.openCount),
    wonOpportunities: intValue(opportunities.wonCount),
    openProposals: intValue(proposals.openProposals),
    acceptedProposals: intValue(proposals.acceptedProposals),
    acceptedProposalAnnualValue: numericValue(proposals.acceptedAnnualValue),
    overdueTasks: intValue(taskResult.rows[0]?.count),
    leadsWithoutNextAction: intValue(stale.withoutNextAction),
    staleLeads: intValue(stale.staleLeads),
    stageBreakdown: stageResult.rows.map((row) => ({ stage: row.stage as PipelineStageKey, count: intValue(row.count), value: numericValue(row.value) })),
    attentionLeads: attentionResult.rows.map((row) => ({ id: row.id as string, name: row.name as string, stage: row.stage as PipelineStageKey, reason: row.reason as string, updatedAt: row.updatedAt as string, nextActionAt: row.nextActionAt as string | null })),
  };
}

export function createPgDashboardRepository(databaseUrl: string): DashboardRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getMetrics(tenantId, allowedStages) {
      const stageFilter = stageClause('l', allowedStages, 2);
      const params = [tenantId, ...stageParams(allowedStages)];

      const [newLeads, noFollowup, overdueTasks, openProposals, bySource, byStage, byPlatform, recentEvents] = await Promise.all([
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.created_at >= current_date${stageFilter}`, params),
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.stage <> 'perdido' and (l.next_action_at is null or l.next_action_at < now())${stageFilter}`, params),
        pool.query(`select count(*)::int as count from tasks t left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id where t.tenant_id = $1 and t.status in ('pendente', 'atrasado') and t.due_date is not null and t.due_date < now()${stageClause('l', allowedStages, 2)}`, params),
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.stage = 'proposta_enviada'${stageFilter}`, params),
        pool.query(`select coalesce(nullif(l.lead_source, ''), 'desconhecido') as source, count(*)::int as count from leads l where l.tenant_id = $1${stageFilter} group by 1 order by count desc, source asc limit 8`, params),
        pool.query(`select l.stage::text as stage, count(*)::int as count from leads l where l.tenant_id = $1${stageFilter} group by l.stage order by count desc`, params),
        pool.query(`select coalesce(nullif(t.platform, ''), 'desconhecido') as platform, count(*)::int as count from tracking_events t left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id where t.tenant_id = $1 and t.status = 'sent'${stageClause('l', allowedStages, 2)} group by 1 order by count desc, platform asc limit 6`, params),
        pool.query(`select a.id,
                           a.tenant_id as "tenantId",
                           a.lead_id as "leadId",
                           a.contact_id as "contactId",
                           a.user_id as "userId",
                           a.activity_type::text as "activityType",
                           coalesce(a.outcome, '') as outcome,
                           a.response_time_seconds as "responseTimeSeconds",
                           a.notes,
                           a.occurred_at::text as "occurredAt",
                           a.created_at::text as "createdAt",
                           l.stage::text as "leadStage"
                      from activities a
                      join leads l on l.tenant_id = a.tenant_id and l.id = a.lead_id
                     where a.tenant_id = $1${stageFilter}
                     order by a.occurred_at desc, a.created_at desc
                     limit 8`, params),
      ]);

      return {
        newLeadsToday: countValue(newLeads.rows[0]),
        leadsWithoutFollowup: countValue(noFollowup.rows[0]),
        overdueTasks: countValue(overdueTasks.rows[0]),
        openProposals: countValue(openProposals.rows[0]),
        leadsBySource: bySource.rows.map((row) => ({ source: String(row.source), count: countValue(row) })),
        leadsByStage: byStage.rows.map((row) => ({ stage: row.stage as PipelineStageKey, count: countValue(row) })),
        conversionsByPlatform: byPlatform.rows.map((row) => ({ platform: String(row.platform), count: countValue(row) })),
        recentEvents: recentEvents.rows.map(rowToActivity),
        commercial: await getCommercialMetrics(pool, tenantId, allowedStages),
      };
    },
    async close() {
      await pool.end();
    },
  };
}
