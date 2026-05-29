import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { Activity, ActivityType } from '../engagement/repository.ts';

const { Pool } = pg;

export type DashboardCount = { count: number };
export type LeadsBySource = { source: string; count: number };
export type LeadsByStage = { stage: PipelineStageKey; count: number };
export type ConversionsByPlatform = { platform: string; count: number };

export type DashboardMetrics = {
  newLeadsToday: number;
  leadsWithoutFollowup: number;
  overdueTasks: number;
  openProposals: number;
  leadsBySource: LeadsBySource[];
  leadsByStage: LeadsByStage[];
  conversionsByPlatform: ConversionsByPlatform[];
  recentEvents: Activity[];
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
      };
    },
    async close() {
      await pool.end();
    },
  };
}
