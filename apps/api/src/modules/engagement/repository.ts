import pg, { type PoolClient } from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AuditContext } from '../users/repository.ts';
import type { ActivityInput, TaskInput } from './validation.ts';

const { Pool } = pg;

export type TaskStatus = 'pendente' | 'concluido' | 'atrasado' | 'cancelado';
export type PriorityLevel = 'baixa' | 'media' | 'alta' | 'urgente';
export type ActivityType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note' | 'stage_change';

export type Task = {
  id: string;
  tenantId: string;
  leadId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  leadName: string | null;
  leadStage: PipelineStageKey | null;
};

export type Activity = {
  id: string;
  tenantId: string;
  leadId: string;
  contactId: string | null;
  userId: string | null;
  activityType: ActivityType;
  outcome: string;
  responseTimeSeconds: number | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  leadStage: PipelineStageKey | null;
};

export type EngagementRepository = {
  listTasks(tenantId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Task[]>;
  listTasksForLead(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Task[] | null>;
  createTask(context: AuditContext, input: TaskInput, allowedStages?: PipelineStageKey[] | null, ownerUserId?: string | null): Promise<Task | null>;
  completeTask(context: AuditContext, taskId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Task | null>;
  listActivities(tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Activity[]>;
  createActivity(context: AuditContext, input: ActivityInput, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<Activity | null>;
  close?(): Promise<void>;
};

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string | null,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as TaskStatus,
    priority: row.priority as PriorityLevel,
    ownerId: row.ownerId as string | null,
    ownerName: row.ownerName as string | null,
    dueDate: row.dueDate as string | null,
    notes: row.notes as string | null,
    completedAt: row.completedAt as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    leadName: row.leadName as string | null,
    leadStage: row.leadStage as PipelineStageKey | null,
  };
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

const taskSelect = `select t.id,
                          t.tenant_id as "tenantId",
                          t.lead_id as "leadId",
                          t.title,
                          t.description,
                          t.status::text as status,
                          t.priority::text as priority,
                          t.owner_id as "ownerId",
                          u.name as "ownerName",
                          t.due_date::text as "dueDate",
                          t.notes,
                          t.completed_at::text as "completedAt",
                          t.created_at::text as "createdAt",
                          t.updated_at::text as "updatedAt",
                          c.name as "leadName",
                          l.stage::text as "leadStage"
                     from tasks t
                left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id
                left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
                left join users u on u.tenant_id = t.tenant_id and u.id = t.owner_id`;

const activitySelect = `select a.id,
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
                          join leads l on l.tenant_id = a.tenant_id and l.id = a.lead_id`;

function stageClause(alias: string, allowedStages: PipelineStageKey[] | null, offset: number, allowNullLead = false): string {
  if (allowedStages === null) return '';
  return allowNullLead ? ` and (${alias}.stage is null or ${alias}.stage = any($${offset}::lead_stage[]))` : ` and ${alias}.stage = any($${offset}::lead_stage[])`;
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

async function leadIsVisible(client: PoolClient, tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null): Promise<boolean> {
  const result = await client.query(
    `select 1 from leads l where l.tenant_id = $1 and l.id = $2${stageClause('l', allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)} limit 1`,
    [tenantId, leadId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)],
  );
  return result.rowCount === 1;
}

async function writeAudit(client: PoolClient, context: AuditContext, entityType: string, entityId: string, action: string, beforeData: unknown, afterData: unknown): Promise<void> {
  await client.query(
    `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, ip_address, user_agent)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, nullif($8, '')::inet, $9)`,
    [context.tenantId, context.actorUserId, entityType, entityId, action, beforeData ? JSON.stringify(beforeData) : null, afterData ? JSON.stringify(afterData) : null, context.ipAddress ?? null, context.userAgent ?? null],
  );
}

export function createPgEngagementRepository(databaseUrl: string): EngagementRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async listTasks(tenantId, allowedStages, ownerUserId) {
      const result = await pool.query(
        `${taskSelect}
          where t.tenant_id = $1${stageClause('l', allowedStages, 2, true)}${ownerClause(ownerUserId, 2 + stageParams(allowedStages).length)}
          order by coalesce(t.due_date, t.created_at) asc, t.created_at desc`,
        [tenantId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)],
      );
      return result.rows.map(rowToTask);
    },
    async listTasksForLead(tenantId, leadId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        if (!(await leadIsVisible(client, tenantId, leadId, allowedStages, ownerUserId))) return null;
        const result = await client.query(
          `${taskSelect}
            where t.tenant_id = $1 and t.lead_id = $2${stageClause('l', allowedStages, 3)}
            order by coalesce(t.due_date, t.created_at) asc, t.created_at desc`,
          [tenantId, leadId, ...stageParams(allowedStages)],
        );
        return result.rows.map(rowToTask);
      } finally {
        client.release();
      }
    },
    async createTask(context, input, allowedStages = null, ownerUserId = null) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (input.leadId && !(await leadIsVisible(client, context.tenantId, input.leadId, allowedStages, ownerUserId))) {
          await client.query("rollback");
          return null;
        }
        const result = await client.query(
          `insert into tasks (tenant_id, lead_id, title, description, priority, owner_id, due_date, notes)
           values ($1, $2, $3, $4, coalesce($5::priority_level, 'media'), $6, $7, $8)
           returning id`,
          [context.tenantId, input.leadId ?? null, input.title, input.description ?? null, input.priority ?? null, input.ownerId ?? context.actorUserId, input.dueDate ?? null, input.notes ?? null],
        );
        const taskId = result.rows[0].id as string;
        const selected = await client.query(`${taskSelect} where t.tenant_id = $1 and t.id = $2`, [context.tenantId, taskId]);
        const task = selected.rows[0] ? rowToTask(selected.rows[0]) : null;
        if (!task) return null;
        await writeAudit(client, context, 'task', task.id, 'task.created', null, task);
        await client.query('commit');
        return task;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async completeTask(context, taskId, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const beforeResult = await client.query(
          `${taskSelect}
            where t.tenant_id = $1 and t.id = $2${stageClause('l', allowedStages, 3, true)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
            for update of t`,
          [context.tenantId, taskId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)],
        );
        const before = beforeResult.rows[0] ? rowToTask(beforeResult.rows[0]) : null;
        if (!before) {
          await client.query("rollback");
          return null;
        }
        await client.query(`update tasks set status = 'concluido', completed_at = now(), updated_at = now() where tenant_id = $1 and id = $2`, [context.tenantId, taskId]);
        const afterResult = await client.query(`${taskSelect} where t.tenant_id = $1 and t.id = $2`, [context.tenantId, taskId]);
        const after = rowToTask(afterResult.rows[0]);
        await writeAudit(client, context, 'task', taskId, 'task.completed', before, after);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async listActivities(tenantId, leadId, allowedStages, ownerUserId) {
      const result = await pool.query(
        `${activitySelect}
          where a.tenant_id = $1 and a.lead_id = $2${stageClause('l', allowedStages, 3)}${ownerClause(ownerUserId, 3 + stageParams(allowedStages).length)}
          order by a.occurred_at desc, a.created_at desc`,
        [tenantId, leadId, ...stageParams(allowedStages), ...ownerParams(ownerUserId)],
      );
      return result.rows.map(rowToActivity);
    },
    async createActivity(context, input, allowedStages, ownerUserId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (!(await leadIsVisible(client, context.tenantId, input.leadId, allowedStages, ownerUserId))) {
          await client.query("rollback");
          return null;
        }
        const contactResult = await client.query('select contact_id from leads where tenant_id = $1 and id = $2', [context.tenantId, input.leadId]);
        const contactId = contactResult.rows[0]?.contact_id as string | undefined;
        const result = await client.query(
          `insert into activities (tenant_id, lead_id, contact_id, user_id, activity_type, outcome, response_time_seconds, notes, occurred_at)
           values ($1, $2, $3, $4, $5::activity_type, $6, $7, $8, coalesce($9, now()))
           returning id`,
          [context.tenantId, input.leadId, contactId ?? null, context.actorUserId, input.activityType, input.outcome, input.responseTimeSeconds ?? null, input.notes ?? null, input.occurredAt ?? null],
        );
        const activityId = result.rows[0].id as string;
        const selected = await client.query(`${activitySelect} where a.tenant_id = $1 and a.id = $2`, [context.tenantId, activityId]);
        const activity = selected.rows[0] ? rowToActivity(selected.rows[0]) : null;
        if (!activity) return null;
        await writeAudit(client, context, 'activity', activity.id, 'activity.created', null, activity);
        await client.query('commit');
        return activity;
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
