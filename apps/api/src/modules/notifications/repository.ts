import pg, { type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';

type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

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

export type NotificationsRepository = {
  create(input: CreateNotificationInput, client?: PoolClient): Promise<Notification>;
  listForUser(tenantId: string, userId: string, limit?: number): Promise<{ notifications: Notification[]; unreadCount: number }>;
  markAsRead(tenantId: string, userId: string, id: string): Promise<Notification | null>;
  markAllAsRead(tenantId: string, userId: string): Promise<number>;
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

export function createPgNotificationsRepository(databaseUrl: string): NotificationsRepository {
  const pool = new pg.Pool({ connectionString: databaseUrl });
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
          input.severity ?? 'info',
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
  };
}
