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

export type LeadsBySeller = { name: string; count: number };

export type DashboardMetrics = {
  newLeadsToday: number;
  leadsWithoutFollowup: number;
  overdueTasks: number;
  openProposals: number;
  leadsBySource: LeadsBySource[];
  leadsByStage: LeadsByStage[];
  leadsBySeller: LeadsBySeller[];
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

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function appendLeadFilters(clauses: string[], params: unknown[], filters: DashboardFilters = {}, alias = 'l'): void {
  if (filters.startDate) clauses.push(`(${alias}.created_at at time zone 'America/Sao_Paulo')::date >= ${pushParam(params, filters.startDate)}::date`);
  if (filters.endDate) clauses.push(`(${alias}.created_at at time zone 'America/Sao_Paulo')::date <= ${pushParam(params, filters.endDate)}::date`);
  if (filters.stage) clauses.push(`${alias}.stage = ${pushParam(params, filters.stage)}::lead_stage`);
  if (filters.source) clauses.push(`coalesce(nullif(${alias}.lead_source, ''), 'desconhecido') = ${pushParam(params, filters.source)}`);
  if (filters.platform) clauses.push(`exists (select 1 from tracking_events tf where tf.tenant_id = ${alias}.tenant_id and tf.lead_id = ${alias}.id and tf.status = 'sent' and coalesce(nullif(tf.platform, ''), 'desconhecido') = ${pushParam(params, filters.platform)})`);
}

function appendStageScope(clauses: string[], params: unknown[], allowedStages: PipelineStageKey[] | null, alias = 'l'): void {
  if (allowedStages !== null) clauses.push(`${alias}.stage = any(${pushParam(params, allowedStages)}::lead_stage[])`);
}

function filteredLeadsCte(params: unknown[], allowedStages: PipelineStageKey[] | null, filters: DashboardFilters = {}): string {
  const clauses: string[] = ['l.tenant_id = $1'];
  appendStageScope(clauses, params, allowedStages, 'l');
  appendLeadFilters(clauses, params, filters, 'l');
  return `with filtered_leads as (
    select l.*
      from leads l
     where ${clauses.join(' and ')}
  )`;
}

const pipelineOrderSql = `array_position(array['novo_lead','qualificacao','atendimento_iniciado','conta_recebida','diagnostico','proposta_enviada','contrato_enervita','perdido']::lead_stage[], fl.stage)`;
const opportunityValueSql = 'coalesce(nullif(fl.estimated_ticket, 0), nullif(fl.energy_bill_value, 0), 0)';

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

/**
 * Calculate commercial metrics directly from leads table instead of lead_opportunities.
 * The lead_opportunities table was never populated — all progression data lives in
 * leads.stage, leads.energy_bill_value, and lead_stage_history.
 */
async function getCommercialMetrics(pool: pg.Pool, tenantId: string, allowedStages: PipelineStageKey[] | null, filters: DashboardFilters = {}): Promise<CommercialMetrics> {
  const valueParams: unknown[] = [tenantId];
  const valueCte = filteredLeadsCte(valueParams, allowedStages, filters);
  const valueResult = await pool.query(
    `${valueCte}
     select
       coalesce(sum(${opportunityValueSql}) filter (where fl.stage not in ('perdido', 'contrato_enervita')), 0)::numeric as "openValue",
       coalesce(sum(${opportunityValueSql}) filter (where fl.stage = 'contrato_enervita'), 0)::numeric as "wonValue",
       count(*) filter (where fl.stage not in ('perdido', 'contrato_enervita'))::int as "openCount",
       count(*) filter (where fl.stage = 'contrato_enervita')::int as "wonCount"
     from filtered_leads fl`,
    valueParams,
  );

  const proposalParams: unknown[] = [tenantId];
  const proposalCte = filteredLeadsCte(proposalParams, allowedStages, filters);
  const proposalResult = await pool.query(
    `${proposalCte}
     select count(*) filter (where p.status in ('draft', 'sent'))::int as "openProposals",
            count(*) filter (where p.status = 'accepted')::int as "acceptedProposals",
            coalesce(sum(p.projected_annual_savings) filter (where p.status = 'accepted'), 0)::text as "acceptedAnnualValue"
       from proposals p
       join filtered_leads fl on fl.tenant_id = p.tenant_id and fl.id = p.lead_id
      where p.tenant_id = $1`,
    proposalParams,
  );

  const taskParams: unknown[] = [tenantId];
  const taskCte = filteredLeadsCte(taskParams, allowedStages, filters);
  const taskResult = await pool.query(
    `${taskCte}
     select count(*)::int as count
       from tasks t
       join filtered_leads fl on fl.tenant_id = t.tenant_id and fl.id = t.lead_id
      where t.tenant_id = $1
        and t.status in ('pendente', 'atrasado')
        and t.due_date is not null
        and t.due_date < now()`,
    taskParams,
  );

  const staleParams: unknown[] = [tenantId];
  const staleCte = filteredLeadsCte(staleParams, allowedStages, filters);
  const staleResult = await pool.query(
    `${staleCte}
     select count(*) filter (where fl.next_action_at is null and fl.stage <> 'perdido')::int as "withoutNextAction",
            count(*) filter (where fl.updated_at < now() - interval '7 days' and fl.stage not in ('perdido', 'contrato_enervita'))::int as "staleLeads"
       from filtered_leads fl`,
    staleParams,
  );

  const stageParams: unknown[] = [tenantId];
  const stageCte = filteredLeadsCte(stageParams, allowedStages, filters);
  const stageBreakdown = await pool.query(
    `${stageCte}
     select fl.stage::text as stage,
            count(*)::int as count,
            coalesce(sum(${opportunityValueSql}), 0)::numeric as value
       from filtered_leads fl
      group by fl.stage
      order by ${pipelineOrderSql}`,
    stageParams,
  );

  const attentionParams: unknown[] = [tenantId];
  const attentionCte = filteredLeadsCte(attentionParams, allowedStages, filters);
  const attentionLeads = await pool.query(
    `${attentionCte}
     select fl.id,
            c.name,
            fl.stage::text as stage,
            case
              when exists (select 1 from tasks t where t.tenant_id = fl.tenant_id and t.lead_id = fl.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 'Tarefa vencida'
              when fl.next_action_at is null then 'Sem próxima ação'
              when fl.updated_at < now() - interval '7 days' then 'Lead parado'
              else 'Atenção'
            end as reason,
            fl.updated_at::text as "updatedAt",
            fl.next_action_at::text as "nextActionAt"
       from filtered_leads fl
       join contacts c on c.tenant_id = fl.tenant_id and c.id = fl.contact_id
      where fl.stage not in ('perdido', 'contrato_enervita')
        and (
          fl.next_action_at is null
          or fl.updated_at < now() - interval '7 days'
          or exists (select 1 from tasks t where t.tenant_id = fl.tenant_id and t.lead_id = fl.id and t.status not in ('concluido', 'cancelado') and t.due_date < now())
        )
      order by
        case
          when exists (select 1 from tasks t where t.tenant_id = fl.tenant_id and t.lead_id = fl.id and t.status not in ('concluido', 'cancelado') and t.due_date < now()) then 1
          when fl.next_action_at is null then 2
          else 3
        end,
        fl.updated_at asc
      limit 8`,
    attentionParams,
  );

  const opportunities = valueResult.rows[0] ?? {};
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
      const leadCte = filteredLeadsCte(leadParams, allowedStages, filters);

      const taskParams: unknown[] = [tenantId];
      const taskCte = filteredLeadsCte(taskParams, allowedStages, filters);

      const proposalParams: unknown[] = [tenantId];
      const proposalCte = filteredLeadsCte(proposalParams, allowedStages, filters);

      const platformParams: unknown[] = [tenantId];
      const platformCte = filteredLeadsCte(platformParams, allowedStages, filters);
      const platformFilter = filters.platform ? ` and coalesce(nullif(t.platform, ''), 'desconhecido') = ${pushParam(platformParams, filters.platform)}` : '';

      const eventParams: unknown[] = [tenantId];
      const eventCte = filteredLeadsCte(eventParams, allowedStages, filters);
      const eventTypeFilter = filters.activityType ? ` and a.activity_type = ${pushParam(eventParams, filters.activityType)}::activity_type` : '';

      const [newLeads, noFollowup, overdueTasks, openProposals, bySource, byStage, bySeller, byPlatform, recentEvents] = await Promise.all([
        pool.query(`${leadCte} select count(*)::int as count from filtered_leads`, leadParams),
        pool.query(`${leadCte} select count(*)::int as count from filtered_leads fl where fl.stage <> 'perdido' and (fl.next_action_at is null or fl.next_action_at < now())`, leadParams),
        pool.query(`${taskCte} select count(*)::int as count from tasks t join filtered_leads fl on fl.tenant_id = t.tenant_id and fl.id = t.lead_id where t.tenant_id = $1 and t.status in ('pendente', 'atrasado') and t.due_date is not null and t.due_date < now()`, taskParams),
        pool.query(`${proposalCte} select count(*)::int as count from proposals p join filtered_leads fl on fl.tenant_id = p.tenant_id and fl.id = p.lead_id where p.tenant_id = $1 and p.status in ('draft', 'sent')`, proposalParams),
        pool.query(`${leadCte} select coalesce(nullif(fl.lead_source, ''), 'desconhecido') as source, count(*)::int as count from filtered_leads fl group by 1 order by count desc, source asc limit 8`, leadParams),
        pool.query(`${leadCte} select fl.stage::text as stage, count(*)::int as count from filtered_leads fl group by fl.stage order by ${pipelineOrderSql}`, leadParams),
        pool.query(`${leadCte} select coalesce(u.name, 'Sem vendedor') as name, count(*)::int as count from filtered_leads fl left join users u on u.id = fl.sdr_owner_id group by u.name order by count desc`, leadParams),
        pool.query(`${platformCte} select coalesce(nullif(t.platform, ''), 'desconhecido') as platform, count(*)::int as count from tracking_events t join filtered_leads fl on fl.tenant_id = t.tenant_id and fl.id = t.lead_id where t.tenant_id = $1 and t.status = 'sent'${platformFilter} group by 1 order by count desc, platform asc limit 6`, platformParams),
        pool.query(`${eventCte} select a.id,
                           a.tenant_id as "tenantId",
                           a.lead_id as "leadId",
                           a.contact_id as "contactId",
                           a.user_id as "userId",
                           a.activity_type as "activityType",
                           a.outcome,
                           a.response_time_seconds as "responseTimeSeconds",
                           a.notes,
                           a.occurred_at::text as "occurredAt",
                           a.created_at::text as "createdAt",
                           fl.stage::text as "leadStage"
                      from activities a
                      join filtered_leads fl on fl.tenant_id = a.tenant_id and fl.id = a.lead_id
                     where a.tenant_id = $1${eventTypeFilter}
                     order by a.occurred_at desc, a.created_at desc
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
        leadsBySeller: bySeller.rows,
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
