import pg from "pg";
import type { PipelineStageKey } from "@enervita/shared";

const { Pool } = pg;

export type FollowUpStatus =
  | "pending"
  | "sent"
  | "skipped"
  | "failed"
  | "cancelled";
export type FollowUpChannel = "manual" | "whatsapp" | "email";
export type FollowUpRuleKey =
  | "task_overdue"
  | "lead_without_next_action"
  | "proposal_no_response"
  | "opportunity_stale";

export type FollowUpQueueItem = {
  id: string;
  tenantId: string;
  leadId: string;
  ruleKey: FollowUpRuleKey | string;
  channel: FollowUpChannel;
  reason: string;
  status: FollowUpStatus;
  scheduledAt: string;
  sentAt: string | null;
  skippedAt: string | null;
  failedAt: string | null;
  attempts: number;
  lastError: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  suggestedMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateFollowUpInput = {
  tenantId: string;
  leadId: string;
  ruleKey: FollowUpRuleKey | string;
  reason: string;
  channel?: FollowUpChannel;
  scheduledAt?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type FollowUpQueueFilters = {
  status?: FollowUpStatus;
  ruleKey?: string;
  limit?: number;
};

export type FollowUpRuleRunResult = {
  created: Record<FollowUpRuleKey, number>;
  existing: Record<FollowUpRuleKey, number>;
};

export type FollowUpActionActor = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type FollowUpsRepository = {
  createPending(
    input: CreateFollowUpInput,
  ): Promise<{ item: FollowUpQueueItem; created: boolean }>;
  listQueue(
    tenantId: string,
    filters?: FollowUpQueueFilters,
  ): Promise<FollowUpQueueItem[]>;
  markSkipped(
    tenantId: string,
    id: string,
    reason?: string,
    actor?: FollowUpActionActor,
  ): Promise<FollowUpQueueItem | null>;
  markSent(
    tenantId: string,
    id: string,
    actor?: FollowUpActionActor,
  ): Promise<FollowUpQueueItem | null>;
  markFailed(
    tenantId: string,
    id: string,
    error: string,
    actor?: FollowUpActionActor,
  ): Promise<FollowUpQueueItem | null>;
  runRules(
    tenantId: string,
    allowedStages: PipelineStageKey[] | null,
  ): Promise<FollowUpRuleRunResult>;
  close?(): Promise<void>;
};

type Candidate = {
  leadId: string;
  ruleKey: FollowUpRuleKey;
  reason: string;
  metadata: Record<string, unknown>;
};

function intValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function jsonValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || "Olá";
}

function buildSuggestedMessage(row: Record<string, unknown>) {
  const leadName = firstName((row.contactName as string | null) ?? null);
  const ruleKey = row.ruleKey as FollowUpRuleKey;
  if (ruleKey === "proposal_no_response")
    return `${leadName}, passando para saber se conseguiu avaliar a proposta e se posso te ajudar com alguma dúvida.`;
  if (ruleKey === "task_overdue")
    return `${leadName}, estou passando para retomar nosso próximo passo combinado.`;
  if (ruleKey === "opportunity_stale")
    return `${leadName}, queria retomar nossa conversa e entender se ainda faz sentido avançarmos com a análise.`;
  return `${leadName}, tudo bem? Estou passando para dar continuidade ao seu atendimento.`;
}

function rowToFollowUp(row: Record<string, unknown>): FollowUpQueueItem {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string,
    ruleKey: row.ruleKey as string,
    channel: row.channel as FollowUpChannel,
    reason: row.reason as string,
    status: row.status as FollowUpStatus,
    scheduledAt: row.scheduledAt as string,
    sentAt: (row.sentAt as string | null) ?? null,
    skippedAt: (row.skippedAt as string | null) ?? null,
    failedAt: (row.failedAt as string | null) ?? null,
    attempts: intValue(row.attempts),
    lastError: (row.lastError as string | null) ?? null,
    idempotencyKey: row.idempotencyKey as string,
    metadata: jsonValue(row.metadata),
    contactName: (row.contactName as string | null) ?? null,
    contactPhone: (row.contactPhone as string | null) ?? null,
    contactEmail: (row.contactEmail as string | null) ?? null,
    suggestedMessage: buildSuggestedMessage(row),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function actionMetadata(
  action: "sent" | "skipped" | "failed",
  actor?: FollowUpActionActor,
  extra: Record<string, unknown> = {},
) {
  return {
    followUpAudit: {
      action,
      actor: actor
        ? {
            id: actor.id,
            name: actor.name ?? null,
            email: actor.email ?? null,
          }
        : null,
      at: new Date().toISOString(),
      ...extra,
    },
  };
}

async function recordFollowUpActivity(
  pool: pg.Pool,
  tenantId: string,
  followUpId: string,
  actor: FollowUpActionActor | undefined,
  input: {
    activityType: "note" | "whatsapp" | "email";
    outcome: string;
    notes: string;
  },
) {
  if (!actor?.id) return;
  await pool.query(
    `insert into activities (tenant_id, lead_id, contact_id, user_id, activity_type, outcome, notes, occurred_at)
       select fq.tenant_id, fq.lead_id, l.contact_id, $3, $4::activity_type, $5, $6, now()
         from follow_up_queue fq
         left join leads l on l.tenant_id = fq.tenant_id and l.id = fq.lead_id
        where fq.tenant_id = $1 and fq.id = $2`,
    [
      tenantId,
      followUpId,
      actor.id,
      input.activityType,
      input.outcome,
      input.notes,
    ],
  );
}

async function notifyAdminsAboutFollowUp(
  pool: pg.Pool,
  item: FollowUpQueueItem,
) {
  const admins = await pool.query(
    `select u.id
       from users u
       join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
       join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
      where u.tenant_id = $1
        and u.status = 'active'
        and r.name = 'admin'`,
    [item.tenantId],
  );
  for (const admin of admins.rows) {
    await pool.query(
      `insert into notifications (tenant_id, user_id, lead_id, type, severity, title, body, href, metadata)
       select $1, $2, $3, 'follow_up_pending', 'warning', $4, $5, $6, $7::jsonb
       where not exists (
         select 1 from notifications
          where tenant_id = $1
            and user_id = $2
            and metadata->>'followUpId' = $8
            and read_at is null
       )`,
      [
        item.tenantId,
        admin.id,
        item.leadId,
        "Follow-up pendente",
        item.reason,
        `/automations?followUp=${item.id}`,
        JSON.stringify({
          rule: "follow_up_pending",
          entityId: item.leadId,
          followUpId: item.id,
          ruleKey: item.ruleKey,
        }),
        item.id,
      ],
    );
  }
}

const followUpSelect = `
  fq.id,
  fq.tenant_id as "tenantId",
  fq.lead_id as "leadId",
  fq.rule_key as "ruleKey",
  fq.idempotency_key as "idempotencyKey",
  fq.channel,
  fq.reason,
  fq.status,
  fq.scheduled_at::text as "scheduledAt",
  fq.sent_at::text as "sentAt",
  fq.skipped_at::text as "skippedAt",
  fq.failed_at::text as "failedAt",
  fq.attempts,
  fq.last_error as "lastError",
  fq.metadata,
  c.name as "contactName",
  c.phone as "contactPhone",
  c.email as "contactEmail",
  fq.created_at::text as "createdAt",
  fq.updated_at::text as "updatedAt"
`;

function stageClause(
  allowedStages: PipelineStageKey[] | null,
  offset: number,
): string {
  if (allowedStages === null) return "";
  return ` and l.stage = any($${offset}::lead_stage[])`;
}

function ruleWindow(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function idempotencyKey(ruleKey: string, leadId: string): string {
  return `${ruleKey}:${leadId}:${ruleWindow()}`;
}

function emptyRuleResult(): FollowUpRuleRunResult {
  return {
    created: {
      task_overdue: 0,
      lead_without_next_action: 0,
      proposal_no_response: 0,
      opportunity_stale: 0,
    },
    existing: {
      task_overdue: 0,
      lead_without_next_action: 0,
      proposal_no_response: 0,
      opportunity_stale: 0,
    },
  };
}

const followUpReturningSelect = `
  id,
  tenant_id as "tenantId",
  lead_id as "leadId",
  rule_key as "ruleKey",
  idempotency_key as "idempotencyKey",
  channel,
  reason,
  status,
  scheduled_at::text as "scheduledAt",
  sent_at::text as "sentAt",
  skipped_at::text as "skippedAt",
  failed_at::text as "failedAt",
  attempts,
  last_error as "lastError",
  metadata,
  null::text as "contactName",
  null::text as "contactPhone",
  null::text as "contactEmail",
  created_at::text as "createdAt",
  updated_at::text as "updatedAt"
`;

async function collectCandidates(
  pool: pg.Pool,
  tenantId: string,
  allowedStages: PipelineStageKey[] | null,
): Promise<Candidate[]> {
  const params =
    allowedStages === null ? [tenantId] : [tenantId, allowedStages];
  const scopedStage = stageClause(allowedStages, 2);

  const [
    overdueTasks,
    leadsWithoutAction,
    proposalsNoResponse,
    staleOpportunities,
  ] = await Promise.all([
    pool.query(
      `select l.id as "leadId", t.id as "taskId", t.title, t.due_date::text as "dueDate"
         from tasks t
         join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id
        where t.tenant_id = $1
          and t.status in ('pendente', 'atrasado')
          and t.due_date is not null
          and t.due_date < now()
          and l.stage not in ('perdido', 'contrato_enervita')
          ${scopedStage}
        order by t.due_date asc
        limit 100`,
      params,
    ),
    pool.query(
      `select l.id as "leadId", l.updated_at::text as "updatedAt", l.next_action_at::text as "nextActionAt"
         from leads l
        where l.tenant_id = $1
          and l.stage not in ('novo_lead', 'perdido', 'contrato_enervita')
          and l.next_action_at is null
          and l.updated_at < now() - interval '7 days'
          ${scopedStage}
        order by l.updated_at asc
        limit 100`,
      params,
    ),
    pool.query(
      `select l.id as "leadId", p.id as "proposalId", p.created_at::text as "proposalCreatedAt"
         from proposals p
         join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
        where p.tenant_id = $1
          and p.status in ('draft', 'sent')
          and p.created_at < now() - interval '3 days'
          and l.stage not in ('perdido', 'contrato_enervita')
          ${scopedStage}
        order by p.created_at asc
        limit 100`,
      params,
    ),
    pool.query(
      `select l.id as "leadId", lo.id as "opportunityId", lo.updated_at::text as "opportunityUpdatedAt"
         from lead_opportunities lo
         join leads l on l.tenant_id = lo.tenant_id and l.id = lo.lead_id
        where lo.tenant_id = $1
          and lo.status = 'open'
          and lo.updated_at < now() - interval '7 days'
          and l.stage not in ('perdido', 'contrato_enervita')
          ${scopedStage}
        order by lo.updated_at asc
        limit 100`,
      params,
    ),
  ]);

  return [
    ...overdueTasks.rows.map((row) => ({
      leadId: row.leadId as string,
      ruleKey: "task_overdue" as const,
      reason: "Tarefa vencida exige follow-up operacional",
      metadata: { taskId: row.taskId, title: row.title, dueDate: row.dueDate },
    })),
    ...leadsWithoutAction.rows.map((row) => ({
      leadId: row.leadId as string,
      ruleKey: "lead_without_next_action" as const,
      reason: "Lead sem próxima ação há mais de 7 dias",
      metadata: { updatedAt: row.updatedAt, nextActionAt: row.nextActionAt },
    })),
    ...proposalsNoResponse.rows.map((row) => ({
      leadId: row.leadId as string,
      ruleKey: "proposal_no_response" as const,
      reason: "Proposta aberta sem resposta há mais de 3 dias",
      metadata: {
        proposalId: row.proposalId,
        proposalCreatedAt: row.proposalCreatedAt,
      },
    })),
    ...staleOpportunities.rows.map((row) => ({
      leadId: row.leadId as string,
      ruleKey: "opportunity_stale" as const,
      reason: "Oportunidade aberta parada há mais de 7 dias",
      metadata: {
        opportunityId: row.opportunityId,
        opportunityUpdatedAt: row.opportunityUpdatedAt,
      },
    })),
  ];
}

export function createPgFollowUpsRepository(
  databaseUrl: string,
): FollowUpsRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async createPending(input) {
      const result = await pool.query(
        `insert into follow_up_queue (tenant_id, lead_id, rule_key, channel, reason, scheduled_at, idempotency_key, metadata)
         values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8::jsonb)
         on conflict (tenant_id, idempotency_key) do update set updated_at = follow_up_queue.updated_at
         returning ${followUpReturningSelect}, (xmax = 0) as inserted`,
        [
          input.tenantId,
          input.leadId,
          input.ruleKey,
          input.channel ?? "manual",
          input.reason,
          input.scheduledAt ?? null,
          input.idempotencyKey,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      return {
        item: rowToFollowUp(result.rows[0]),
        created: Boolean(result.rows[0]?.inserted),
      };
    },

    async listQueue(tenantId, filters = {}) {
      const params: unknown[] = [tenantId];
      const where = ["fq.tenant_id = $1"];
      if (filters.status) {
        params.push(filters.status);
        where.push(`fq.status = $${params.length}`);
      }
      if (filters.ruleKey) {
        params.push(filters.ruleKey);
        where.push(`fq.rule_key = $${params.length}`);
      }
      params.push(Math.min(Math.max(filters.limit ?? 50, 1), 200));
      const result = await pool.query(
        `select ${followUpSelect}
           from follow_up_queue fq
           left join leads l on l.tenant_id = fq.tenant_id and l.id = fq.lead_id
           left join contacts c on c.tenant_id = fq.tenant_id and c.id = l.contact_id
          where ${where.join(" and ")}
          order by fq.scheduled_at asc, fq.created_at asc
          limit $${params.length}`,
        params,
      );
      return result.rows.map(rowToFollowUp);
    },

    async markSkipped(tenantId, id, reason, actor) {
      const audit = actionMetadata("skipped", actor, {
        reason: reason ?? null,
      });
      const result = await pool.query(
        `update follow_up_queue
            set status = 'skipped',
                skipped_at = now(),
                last_error = $3,
                metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = now()
          where tenant_id = $1 and id = $2 and status = 'pending'
          returning ${followUpReturningSelect}`,
        [tenantId, id, reason ?? null, JSON.stringify(audit)],
      );
      if (!result.rows[0]) return null;
      const followUp = rowToFollowUp(result.rows[0]);
      await recordFollowUpActivity(pool, tenantId, id, actor, {
        activityType: "note",
        outcome: "follow_up_skipped",
        notes: `Follow-up pulado. Motivo: ${reason ?? "não informado"}`,
      });
      return followUp;
    },

    async markSent(tenantId, id, actor) {
      const audit = actionMetadata("sent", actor);
      const result = await pool.query(
        `update follow_up_queue
            set status = 'sent',
                sent_at = now(),
                attempts = attempts + 1,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where tenant_id = $1 and id = $2 and status = 'pending'
          returning ${followUpReturningSelect}`,
        [tenantId, id, JSON.stringify(audit)],
      );
      if (!result.rows[0]) return null;
      const followUp = rowToFollowUp(result.rows[0]);
      await recordFollowUpActivity(pool, tenantId, id, actor, {
        activityType: followUp.contactPhone ? "whatsapp" : "note",
        outcome: "follow_up_completed",
        notes: `Follow-up tratado manualmente. Mensagem sugerida: ${followUp.suggestedMessage}`,
      });
      return followUp;
    },

    async markFailed(tenantId, id, error, actor) {
      const audit = actionMetadata("failed", actor, { error });
      const result = await pool.query(
        `update follow_up_queue
            set status = 'failed',
                failed_at = now(),
                attempts = attempts + 1,
                last_error = $3,
                metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = now()
          where tenant_id = $1 and id = $2 and status = 'pending'
          returning ${followUpReturningSelect}`,
        [tenantId, id, error, JSON.stringify(audit)],
      );
      if (!result.rows[0]) return null;
      const followUp = rowToFollowUp(result.rows[0]);
      await recordFollowUpActivity(pool, tenantId, id, actor, {
        activityType: "note",
        outcome: "follow_up_failed",
        notes: `Follow-up marcado como falha. Erro: ${error}`,
      });
      return followUp;
    },

    async runRules(tenantId, allowedStages) {
      const result = emptyRuleResult();
      const candidates = await collectCandidates(pool, tenantId, allowedStages);
      for (const candidate of candidates) {
        const created = await this.createPending({
          tenantId,
          leadId: candidate.leadId,
          ruleKey: candidate.ruleKey,
          reason: candidate.reason,
          idempotencyKey: idempotencyKey(candidate.ruleKey, candidate.leadId),
          metadata: candidate.metadata,
        });
        if (created.created) {
          result.created[candidate.ruleKey] += 1;
          await notifyAdminsAboutFollowUp(pool, created.item);
        } else {
          result.existing[candidate.ruleKey] += 1;
        }
      }
      return result;
    },

    async close() {
      await pool.end();
    },
  };
}

export function createStaticFollowUpsRepository(): FollowUpsRepository {
  const items: FollowUpQueueItem[] = [];
  return {
    async createPending(input) {
      const existing = items.find(
        (item) =>
          item.tenantId === input.tenantId &&
          item.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return { item: existing, created: false };
      const now = new Date().toISOString();
      const item: FollowUpQueueItem = {
        id: `follow-up-${items.length + 1}`,
        tenantId: input.tenantId,
        leadId: input.leadId,
        ruleKey: input.ruleKey,
        channel: input.channel ?? "manual",
        reason: input.reason,
        status: "pending",
        scheduledAt: input.scheduledAt ?? now,
        sentAt: null,
        skippedAt: null,
        failedAt: null,
        attempts: 0,
        lastError: null,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata ?? {},
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        suggestedMessage: buildSuggestedMessage({
          contactName: null,
          ruleKey: input.ruleKey,
        }),
        createdAt: now,
        updatedAt: now,
      };
      items.push(item);
      return { item, created: true };
    },
    async listQueue(tenantId, filters = {}) {
      return items
        .filter(
          (item) =>
            item.tenantId === tenantId &&
            (!filters.status || item.status === filters.status) &&
            (!filters.ruleKey || item.ruleKey === filters.ruleKey),
        )
        .slice(0, filters.limit ?? 50);
    },
    async markSkipped(tenantId, id, reason, actor) {
      const item = items.find(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.id === id &&
          entry.status === "pending",
      );
      if (!item) return null;
      item.status = "skipped";
      item.skippedAt = new Date().toISOString();
      item.lastError = reason ?? null;
      return item;
    },
    async markSent(tenantId, id, actor) {
      const item = items.find(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.id === id &&
          entry.status === "pending",
      );
      if (!item) return null;
      item.status = "sent";
      item.sentAt = new Date().toISOString();
      item.attempts += 1;
      return item;
    },
    async markFailed(tenantId, id, error, actor) {
      const item = items.find(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.id === id &&
          entry.status === "pending",
      );
      if (!item) return null;
      item.status = "failed";
      item.failedAt = new Date().toISOString();
      item.lastError = error;
      item.attempts += 1;
      return item;
    },
    async runRules() {
      return emptyRuleResult();
    },
  };
}
