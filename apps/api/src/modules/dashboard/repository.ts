import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { Activity } from '../engagement/repository.ts';

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

export type DashboardFilters = {
  startDate?: string;
  endDate?: string;
  stage?: PipelineStageKey;
  source?: string;
  platform?: string;
  activityType?: Activity['activityType'];
};

export type DashboardRepository = {
  getMetrics(tenantId: string, allowedStages: PipelineStageKey[] | null, filters?: DashboardFilters): Promise<DashboardMetrics>;
  close?(): Promise<void>;
};

function stageClause(alias: string, allowedStages: PipelineStageKey[] | null, offset: number): string {
  if (allowedStages === null) return '';
  return ` and ${alias}.stage = any($${offset}::lead_stage[])`;
}

function stageParams(allowedStages: PipelineStageKey[] | null): unknown[] {
  return allowedStages === null ? [] : [allowedStages];
}


function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function appendLeadFilters(clauses: string[], params: unknown[], filters: DashboardFilters = {}, alias = 'l'): void {
  if (filters.startDate) clauses.push(`${alias}.created_at >= ${pushParam(params, filters.startDate)}::date`);
  if (filters.endDate) clauses.push(`${alias}.created_at < (${pushParam(params, filters.endDate)}::date + interval '1 day')`);
  if (filters.stage) clauses.push(`${alias}.stage = ${pushParam(params, filters.stage)}::lead_stage`);
  if (filters.source) clauses.push(`coalesce(nullif(${alias}.lead_source, ''), 'desconhecido') = ${pushParam(params, filters.source)}`);
  if (filters.platform) clauses.push(`exists (select 1 from tracking_events tf where tf.tenant_id = ${alias}.tenant_id and tf.lead_id = ${alias}.id and tf.status = 'sent' and coalesce(nullif(tf.platform, ''), 'desconhecido') = ${pushParam(params, filters.platform)})`);
}

function appendStageScope(clauses: string[], params: unknown[], allowedStages: PipelineStageKey[] | null, alias = 'l'): void {
  if (allowedStages !== null) clauses.push(`${alias}.stage = any(${pushParam(params, allowedStages)}::lead_stage[])`);
}

function andSql(clauses: string[]): string {
  return clauses.length ? ` and ${clauses.join(' and ')}` : '';
}

function whereSql(clauses: string[]): string {
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function leadFilterSql(params: unknown[], allowedStages: PipelineStageKey[] | null, filters: DashboardFilters = {}, alias = 'l'): string {
  const clauses: string[] = [];
  appendStageScope(clauses, params, allowedStages, alias);
  appendLeadFilters(clauses, params, filters, alias);
  return andSql(clauses);
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
    activityType: row.activityType as Activity['activityType'],
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

async function getCommercialMetrics(pool: pg.Pool, tenantId: string, allowedStages: PipelineStageKey[] | null, filters: DashboardFilters = {}): Promise<CommercialMetrics> {
  const opportunityParams: unknown[] = [tenantId];
  const opportunityFilter = leadFilterSql(opportunityParams, allowedStages, filters);
  const opportunityResult = await pool.query(
    `select count(*) filter (where lo.status = 'open')::int as "openCount",
            count(*) filter (where lo.status = 'won')::int as "wonCount",
            coalesce(sum(lo.expected_value) filter (where lo.status = 'open'), 0)::text as "openValue",
            coalesce(sum(lo.expected_value) filter (where lo.status = 'won'), 0)::text as "wonValue"
       from lead_opportunities lo
       join leads l on l.tenant_id = lo.tenant_id and l.id = lo.lead_id
      where lo.tenant_id = $1 ${opportunityFilter}`,
    opportunityParams,
  );

  const proposalParams: unknown[] = [tenantId];
  const proposalFilter = leadFilterSql(proposalParams, allowedStages, filters);
  const proposalResult = await pool.query(
    `select count(*) filter (where p.status in ('draft', 'sent'))::int as "openProposals",
            count(*) filter (where p.status = 'accepted')::int as "acceptedProposals",
            coalesce(sum(p.projected_annual_savings) filter (where p.status = 'accepted'), 0)::text as "acceptedAnnualValue"
       from proposals p
       join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
      where p.tenant_id = $1 ${proposalFilter}`,
    proposalParams,
  );

  const taskParams: unknown[] = [tenantId];
  const taskFilter = leadFilterSql(taskParams, allowedStages, filters);
  const taskResult = await pool.query(
    `select count(*)::int as count
       from tasks t
       join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id
      where t.tenant_id = $1
        and t.status in ('pendente', 'atrasado')
        and t.due_date is not null
        and t.due_date < now()
        ${taskFilter}`,
    taskParams,
  );

  const staleParams: unknown[] = [tenantId];
  const staleFilter = leadFilterSql(staleParams, allowedStages, filters);
  const staleResult = await pool.query(
    `select count(*) filter (where l.next_action_at is null and l.stage <> 'perdido')::int as "withoutNextAction",
            count(*) filter (where l.updated_at < now() - interval '7 days' and l.stage not in ('perdido', 'contrato_enervita'))::int as "staleLeads"
       from leads l
      where l.tenant_id = $1 ${staleFilter}`,
    staleParams,
  );

  const stageParams: unknown[] = [tenantId];
  const stageFilter = leadFilterSql(stageParams, allowedStages, filters);
  const stageBreakdown = await pool.query(
    `select l.stage::text as stage,
            count(*)::int as count,
            coalesce(sum(lo.expected_value), 0)::text as value
       from leads l
       left join lead_opportunities lo on lo.tenant_id = l.tenant_id and lo.lead_id = l.id and lo.status = 'open'
      where l.tenant_id = $1 ${stageFilter}
      group by l.stage
      order by count desc`,
    stageParams,
  );

  const attentionParams: unknown[] = [tenantId];
  const attentionFilter = leadFilterSql(attentionParams, allowedStages, filters);
  const attentionLeads = await pool.query(
    `select l.id,
            c.name,
            l.stage::text as stage,
            case
              when exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 'Tarefa vencida'
              when l.next_action_at is null then 'Sem próxima ação'
              when l.updated_at < now() - interval '7 days' then 'Lead parado'
              else 'Atenção'
            end as reason,
            l.updated_at::text as "updatedAt",
            l.next_action_at::text as "nextActionAt"
       from leads l
       join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
      where l.tenant_id = $1
        and l.stage not in ('perdido', 'contrato_enervita')
        and (
          l.next_action_at is null
          or l.updated_at < now() - interval '7 days'
          or exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now())
        )
        ${attentionFilter}
      order by
        case
          when exists (select 1 from tasks t where t.tenant_id = l.tenant_id and t.lead_id = l.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 1
          when l.next_action_at is null then 2
          else 3
        end,
        l.updated_at asc
      limit 8`,
    attentionParams,
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
    stageBreakdown: stageBreakdown.rows.map((row) => ({ stage: row.stage as PipelineStageKey, count: intValue(row.count), value: numericValue(row.value) })),
    attentionLeads: attentionLeads.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      stage: row.stage as PipelineStageKey,
      reason: row.reason as string,
      updatedAt: row.updatedAt as string,
      nextActionAt: (row.nextActionAt as string | null) ?? null,
    })),
  };
}

export function createPgDashboardRepository(databaseUrl: string): DashboardRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getMetrics(tenantId, allowedStages, filters = {}) {
      const leadParams: unknown[] = [tenantId];
      const leadFilter = leadFilterSql(leadParams, allowedStages, filters);

      const todayParams: unknown[] = [tenantId];
      const todayFilter = leadFilterSql(todayParams, allowedStages, { ...filters, startDate: undefined, endDate: undefined });

      const taskParams: unknown[] = [tenantId];
      const taskFilter = leadFilterSql(taskParams, allowedStages, filters);

      const platformParams: unknown[] = [tenantId];
      const platformLeadFilter = leadFilterSql(platformParams, allowedStages, filters);
      const platformFilter = filters.platform ? ` and coalesce(nullif(t.platform, ''), 'desconhecido') = ${pushParam(platformParams, filters.platform)}` : '';

      const eventParams: unknown[] = [tenantId];
      const eventLeadFilter = leadFilterSql(eventParams, allowedStages, filters);
      const eventTypeFilter = filters.activityType ? ` and a.activity_type = ${pushParam(eventParams, filters.activityType)}::activity_type` : '';

      const [newLeads, noFollowup, overdueTasks, openProposals, bySource, byStage, byPlatform, recentEvents] = await Promise.all([
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.created_at >= current_date${todayFilter}`, todayParams),
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.stage <> 'perdido' and (l.next_action_at is null or l.next_action_at < now())${leadFilter}`, leadParams),
        pool.query(`select count(*)::int as count from tasks t left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id where t.tenant_id = $1 and t.status in ('pendente', 'atrasado') and t.due_date is not null and t.due_date < now()${taskFilter}`, taskParams),
        pool.query(`select count(*)::int as count from leads l where l.tenant_id = $1 and l.stage = 'proposta_enviada'${leadFilter}`, leadParams),
        pool.query(`select coalesce(nullif(l.lead_source, ''), 'desconhecido') as source, count(*)::int as count from leads l where l.tenant_id = $1${leadFilter} group by 1 order by count desc, source asc limit 8`, leadParams),
        pool.query(`select l.stage::text as stage, count(*)::int as count from leads l where l.tenant_id = $1${leadFilter} group by l.stage order by count desc`, leadParams),
        pool.query(`select coalesce(nullif(t.platform, ''), 'desconhecido') as platform, count(*)::int as count from tracking_events t left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id where t.tenant_id = $1 and t.status = 'sent'${platformLeadFilter}${platformFilter} group by 1 order by count desc, platform asc limit 6`, platformParams),
        pool.query(`select a.id,
                           a.tenant_id as "tenantId",
                           a.lead_id as "leadId",
                           a.user_id as "userId",
                           a.activity_type as "activityType",
                           a.outcome,
                           a.notes,
                           a.created_at::text as "createdAt",
                           l.stage::text as "leadStage"
                      from activities a
                      join leads l on l.tenant_id = a.tenant_id and l.id = a.lead_id
                     where a.tenant_id = $1${eventLeadFilter}${eventTypeFilter}
                     order by a.created_at desc
                     limit 8`, eventParams),
      ]);

      const commercial = await getCommercialMetrics(pool, tenantId, allowedStages, filters);

      return {
        newLeadsToday: countValue(newLeads.rows[0]),
        leadsWithoutFollowup: countValue(noFollowup.rows[0]),
        overdueTasks: countValue(overdueTasks.rows[0]),
        openProposals: countValue(openProposals.rows[0]),
        leadsBySource: bySource.rows,
        leadsByStage: byStage.rows,
        conversionsByPlatform: byPlatform.rows,
        recentEvents: recentEvents.rows.map(rowToActivity),
        commercial,
      };
    },
    async close() {
      await pool.end();
    },
  };
}
