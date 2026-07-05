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
  | "opportunity_stale"
  | "lead_stale"
  | "seller_inactive";

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
        lead_stale: 0,
        seller_inactive: 0,
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

        // FASE 2: Lead parado - notifica vendedor e admin
        const staleLeads = await client.query(
          `select l.id,
                  l.stage,
                  l.pipeline_key as "pipelineKey",
                  l.sdr_owner_id as "sellerId",
                  c.name as "contactName",
                  u.name as "sellerName",
                  extract(epoch from (now() - l.updated_at)) / 3600 as "hoursStale"
             from leads l
             join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
             join users u on u.tenant_id = l.tenant_id and u.id = l.sdr_owner_id
            where l.tenant_id = $1
              and l.stage not in ('perdido', 'contrato_enervita')
              and l.updated_at < now() - interval '24 hours'
              and l.sdr_owner_id is not null
            order by l.updated_at asc
            limit 100`,
          [tenantId],
        );
        for (const row of staleLeads.rows) {
          const hours = Math.floor(Number(row.hoursStale));
          const days = Math.floor(hours / 24);
          const timeLabel = days > 0 ? `${days} dia${days > 1 ? 's' : ''}` : `${hours} hora${hours > 1 ? 's' : ''}`;
          const severity = hours >= 72 ? 'error' : hours >= 48 ? 'warning' : 'info';

          // Notifica vendedor
          const sellerNotification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: row.sellerId,
              leadId: row.id,
              type: 'lead_stale',
              severity,
              title: `Lead parado há ${timeLabel}`,
              body: `O lead "${row.contactName}" está parado no estágio "${row.stage}" há ${timeLabel}.`,
              href: `/leads/${row.id}`,
              metadata: {
                rule: 'lead_stale',
                entityType: 'lead',
                entityId: row.id,
                bucket,
                hoursStale: hours,
                pipelineKey: row.pipelineKey,
              },
            },
            client,
          );
          if (sellerNotification) created.lead_stale += 1;

          // FASE 5: Enviar evento de lead parado para Meta Ads
          try {
            await client.query(
              `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload)
               values ($1, $2, 'meta', 'EnervitaLeadStale', 'queued', $3::jsonb)`,
              [tenantId, row.id, JSON.stringify({
                leadId: row.id,
                stage: row.stage,
                hoursStale: hours,
                pipelineKey: row.pipelineKey,
                leadEventSource: 'Enervita Custom CRM',
              })],
            );
          } catch {
            // Não falhar a notificação se o Meta event falhar
          }
        }

        // FASE 3: Alerta para admin - agrega por vendedor (1 notificação por vendedor)
        const inactiveSellers = await client.query(
          `select l.sdr_owner_id as "sellerId",
                  u.name as "sellerName",
                  count(*) as "staleCount",
                  min(l.updated_at) as "oldestStale",
                  extract(epoch from (now() - min(l.updated_at))) / 3600 as "hoursInactive",
                  string_agg(distinct l.stage::text, ', ') as "affectedStages",
                  string_agg(distinct l.pipeline_key::text, ', ') as "affectedPipelines"
             from leads l
             join users u on u.tenant_id = l.tenant_id and u.id = l.sdr_owner_id
            where l.tenant_id = $1
              and l.stage not in ('perdido', 'contrato_enervita')
              and l.updated_at < now() - interval '48 hours'
              and l.sdr_owner_id is not null
            group by l.sdr_owner_id, u.name
            order by "hoursInactive" desc
            limit 50`,
          [tenantId],
        );
        for (const seller of inactiveSellers.rows) {
          if (!adminUserId) continue;
          const hours = Math.floor(Number(seller.hoursInactive));
          const days = Math.floor(hours / 24);
          const timeLabel = days > 0 ? `${days} dia${days > 1 ? 's' : ''}` : `${hours} hora${hours > 1 ? 's' : ''}`;
          const severity = hours >= 168 ? 'error' : hours >= 72 ? 'warning' : 'info';
          const stagesLabel = seller.affectedStages || 'N/A';

          const adminNotification = await createIfRuleNotificationMissing(
            {
              tenantId,
              userId: adminUserId,
              type: 'seller_inactive',
              severity,
              title: `${seller.sellerName} com ${seller.staleCount} lead${seller.staleCount > 1 ? 's' : ''} parado${seller.staleCount > 1 ? 's' : ''}`,
              body: `O vendedor ${seller.sellerName} não movimenta ${seller.staleCount} lead(s) há ${timeLabel}. Estágios: ${stagesLabel}. Isso pode causar atraso na inteligência dos anúncios do Meta Ads.`,
              href: `/pipeline?seller=${seller.sellerId}`,
              metadata: {
                rule: 'seller_inactive',
                entityType: 'seller',
                entityId: seller.sellerId,
                bucket,
                sellerId: seller.sellerId,
                sellerName: seller.sellerName,
                staleCount: Number(seller.staleCount),
                hoursInactive: hours,
                affectedStages: seller.affectedStages,
                affectedPipelines: seller.affectedPipelines,
              },
            },
            client,
          );
          if (adminNotification) created.seller_inactive += 1;
        }

        await client.query("commit");
        return {
          created,
          totalCreated:
            created.task_overdue +
            created.lead_without_next_action +
            created.proposal_no_response +
            created.opportunity_stale +
            created.lead_stale +
            created.seller_inactive,
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
