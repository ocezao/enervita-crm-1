import pg, { type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

type NotificationSeverity = "info" | "success" | "warning" | "error";

export type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  taskId: string | null;
  leadId: string | null;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  href: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type CreateNotificationInput = {
  tenantId: string;
  userId: string;
  taskId?: string | null;
  leadId?: string | null;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  body?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationRuleKey =
  | "task_overdue"
  | "lead_without_next_action"
  | "proposal_no_response"
  | "opportunity_stale";

export type NotificationRuleRunResult = {
  created: Record<NotificationRuleKey, number>;
  totalCreated: number;
};

export type NotificationsRepository = {
  create(
    input: CreateNotificationInput,
    client?: PoolClient,
  ): Promise<Notification>;
  listForUser(
    tenantId: string,
    userId: string,
    limit?: number,
  ): Promise<{ notifications: Notification[]; unreadCount: number }>;
  markAsRead(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<Notification | null>;
  markAllAsRead(tenantId: string, userId: string): Promise<number>;
  runCommercialRules(tenantId: string): Promise<NotificationRuleRunResult>;
  close?: () => Promise<void>;
};

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    taskId: row.task_id,
    leadId: row.lead_id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    href: row.href,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function createPgNotificationsRepository(
  databaseUrl: string,
): NotificationsRepository {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  async function createIfRuleNotificationMissing(
    input: CreateNotificationInput,
    client: PoolClient,
  ): Promise<Notification | null> {
    const metadata = input.metadata ?? {};
    const rule = typeof metadata.rule === "string" ? metadata.rule : input.type;
    const entityId =
      typeof metadata.entityId === "string" ? metadata.entityId : null;
    const bucket = typeof metadata.bucket === "string" ? metadata.bucket : null;

    if (!entityId || !bucket)
      throw new Error(
        "Rule notification metadata requires entityId and bucket",
      );

    const existing = await client.query(
      `select id
         from notifications
        where tenant_id = $1
          and user_id = $2
          and metadata->>'rule' = $3
          and metadata->>'entityId' = $4
          and metadata->>'bucket' = $5
        limit 1`,
      [input.tenantId, input.userId, rule, entityId, bucket],
    );
    if ((existing.rowCount ?? 0) > 0) return null;

    const result = await client.query(
      `insert into notifications (id, tenant_id, user_id, task_id, lead_id, type, severity, title, body, href, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       returning *`,
      [
        randomUUID(),
        input.tenantId,
        input.userId,
        input.taskId ?? null,
        input.leadId ?? null,
        input.type,
        input.severity ?? "info",
        input.title,
        input.body ?? null,
        input.href ?? null,
        JSON.stringify(metadata),
      ],
    );
    return mapNotification(result.rows[0]);
  }

  async function firstAdminUser(
    tenantId: string,
    client: PoolClient,
  ): Promise<string | null> {
    const result = await client.query(
      `select u.id
         from users u
         join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
         join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
        where u.tenant_id = $1
          and u.status = 'active'
          and r.name = 'admin'
        order by u.created_at asc
        limit 1`,
      [tenantId],
    );
    return result.rows[0]?.id ?? null;
  }

  return {
    async create(input, client) {
      const db = client ?? pool;
      const result = await db.query(
        `insert into notifications (id, tenant_id, user_id, task_id, lead_id, type, severity, title, body, href, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
         returning *`,
        [
          randomUUID(),
          input.tenantId,
          input.userId,
          input.taskId ?? null,
          input.leadId ?? null,
          input.type,
          input.severity ?? "info",
          input.title,
          input.body ?? null,
          input.href ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      return mapNotification(result.rows[0]);
    },

    async listForUser(tenantId, userId, limit = 20) {
      const [items, count] = await Promise.all([
        pool.query(
          `select * from notifications where tenant_id = $1 and user_id = $2 order by created_at desc limit $3`,
          [tenantId, userId, Math.max(1, Math.min(limit, 50))],
        ),
        pool.query(
          `select count(*)::int as count from notifications where tenant_id = $1 and user_id = $2 and read_at is null`,
          [tenantId, userId],
        ),
      ]);
      return {
        notifications: items.rows.map(mapNotification),
        unreadCount: Number(count.rows[0]?.count ?? 0),
      };
    },

    async markAsRead(tenantId, userId, id) {
      const result = await pool.query(
        `update notifications set read_at = coalesce(read_at, now()) where tenant_id = $1 and user_id = $2 and id = $3 returning *`,
        [tenantId, userId, id],
      );
      return result.rows[0] ? mapNotification(result.rows[0]) : null;
    },

    async close() {
      await pool.end();
    },

    async markAllAsRead(tenantId, userId) {
      const result = await pool.query(
        `update notifications set read_at = coalesce(read_at, now()) where tenant_id = $1 and user_id = $2 and read_at is null`,
        [tenantId, userId],
      );
      return Number(result.rowCount ?? 0);
    },

    async runCommercialRules(tenantId) {
      const client = await pool.connect();
      const created: Record<NotificationRuleKey, number> = {
        task_overdue: 0,
        lead_without_next_action: 0,
        proposal_no_response: 0,
        opportunity_stale: 0,
      };
      const bucket = new Date().toISOString().slice(0, 10);

      try {
        await client.query("begin");
        const adminUserId = await firstAdminUser(tenantId, client);

        const overdueTasks = await client.query(
          `select t.id,
                  t.title,
                  t.lead_id,
                  coalesce(t.owner_id, l.sdr_owner_id, $2::uuid) as "userId",
                  c.name as "contactName"
             from tasks t
             left join leads l on l.tenant_id = t.tenant_id and l.id = t.lead_id
             left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
            where t.tenant_id = $1
              and t.status not in ('concluido', 'cancelado')
              and t.due_date is not null
              and t.due_date < now()
              and coalesce(t.owner_id, l.sdr_owner_id, $2::uuid) is not null
            order by t.due_date asc
            limit 100`,
          [tenantId, adminUserId],
        );
        for (const row of overdueTasks.rows) {
          const notification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: row.userId,
              taskId: row.id,
              leadId: row.lead_id,
              type: "task_overdue",
              severity: "warning",
              title: "Tarefa vencida",
              body: `${row.title}${row.contactName ? ` — ${row.contactName}` : ""}`,
              href: row.lead_id ? `/leads/${row.lead_id}` : "/tasks",
              metadata: {
                rule: "task_overdue",
                entityType: "task",
                entityId: row.id,
                bucket,
              },
            },
            client,
          );
          if (notification) created.task_overdue += 1;
        }

        const leadsWithoutNextAction = await client.query(
          `select l.id,
                  c.name as "contactName",
                  coalesce(l.sdr_owner_id, $2::uuid) as "userId"
             from leads l
             join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
            where l.tenant_id = $1
              and l.stage not in ('novo_lead', 'perdido', 'contrato_enervita')
              and l.next_action_at is null
              and l.updated_at < now() - interval '7 days'
              and coalesce(l.sdr_owner_id, $2::uuid) is not null
            order by l.updated_at asc
            limit 100`,
          [tenantId, adminUserId],
        );
        for (const row of leadsWithoutNextAction.rows) {
          const notification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: row.userId,
              leadId: row.id,
              type: "lead_without_next_action",
              severity: "warning",
              title: "Lead sem próxima ação",
              body: row.contactName
                ? `Defina o próximo passo para ${row.contactName}.`
                : "Defina o próximo passo para este lead.",
              href: `/leads/${row.id}`,
              metadata: {
                rule: "lead_without_next_action",
                entityType: "lead",
                entityId: row.id,
                bucket,
              },
            },
            client,
          );
          if (notification) created.lead_without_next_action += 1;
        }

        const proposalsNoResponse = await client.query(
          `select p.id,
                  p.lead_id,
                  p.title,
                  c.name as "contactName",
                  coalesce(p.created_by, l.sdr_owner_id, $2::uuid) as "userId"
             from proposals p
             join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id
             join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
            where p.tenant_id = $1
              and p.status = 'sent'
              and p.sent_at is not null
              and p.sent_at < now() - interval '3 days'
              and coalesce(p.created_by, l.sdr_owner_id, $2::uuid) is not null
            order by p.sent_at asc
            limit 100`,
          [tenantId, adminUserId],
        );
        for (const row of proposalsNoResponse.rows) {
          const notification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: row.userId,
              leadId: row.lead_id,
              type: "proposal_no_response",
              severity: "warning",
              title: "Proposta sem resposta",
              body: `${row.title}${row.contactName ? ` — ${row.contactName}` : ""}`,
              href: `/leads/${row.lead_id}`,
              metadata: {
                rule: "proposal_no_response",
                entityType: "proposal",
                entityId: row.id,
                bucket,
              },
            },
            client,
          );
          if (notification) created.proposal_no_response += 1;
        }

        const staleOpportunities = await client.query(
          `select lo.id,
                  lo.lead_id,
                  lo.title,
                  c.name as "contactName",
                  coalesce(lo.converted_by, l.sdr_owner_id, $2::uuid) as "userId"
             from lead_opportunities lo
             join leads l on l.tenant_id = lo.tenant_id and l.id = lo.lead_id
             join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
            where lo.tenant_id = $1
              and lo.status = 'open'
              and lo.updated_at < now() - interval '7 days'
              and coalesce(lo.converted_by, l.sdr_owner_id, $2::uuid) is not null
            order by lo.updated_at asc
            limit 100`,
          [tenantId, adminUserId],
        );
        for (const row of staleOpportunities.rows) {
          const notification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: row.userId,
              leadId: row.lead_id,
              type: "opportunity_stale",
              severity: "warning",
              title: "Oportunidade parada",
              body: `${row.title}${row.contactName ? ` — ${row.contactName}` : ""}`,
              href: `/leads/${row.lead_id}`,
              metadata: {
                rule: "opportunity_stale",
                entityType: "opportunity",
                entityId: row.id,
                bucket,
              },
            },
            client,
          );
          if (notification) created.opportunity_stale += 1;
        }

        await client.query("commit");
        return {
          created,
          totalCreated:
            created.task_overdue +
            created.lead_without_next_action +
            created.proposal_no_response +
            created.opportunity_stale,
        };
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
