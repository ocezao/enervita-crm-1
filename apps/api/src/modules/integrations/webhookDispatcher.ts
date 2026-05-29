import pg from 'pg';
import type { WebhookDelivery } from './repository.ts';

const { Pool } = pg;

export type QueuedWebhookDelivery = WebhookDelivery & {
  url: string;
  payload: Record<string, unknown>;
};

export type WebhookHttpResponse = {
  status: number;
  body: string;
};

export type WebhookHttpClient = {
  postJson(url: string, payload: Record<string, unknown>): Promise<WebhookHttpResponse>;
};

export type DeliveryDispatchResult = {
  httpStatus: number | null;
  responseBody: string;
};

export type WebhookDispatchRepository = {
  claimQueuedDeliveries(limit: number): Promise<QueuedWebhookDelivery[]>;
  markDeliverySent(id: string, result: DeliveryDispatchResult): Promise<void>;
  markDeliveryFailed(id: string, result: DeliveryDispatchResult): Promise<void>;
  close?(): Promise<void>;
};

export type WebhookDispatchSummary = {
  processed: number;
  sent: number;
  failed: number;
  blocked: number;
};

export type DispatchQueuedWebhooksOptions = {
  repository: WebhookDispatchRepository;
  httpClient?: WebhookHttpClient;
  allowedHosts: string[];
  limit?: number;
  responseBodyLimit?: number;
};

const DEFAULT_LIMIT = 10;
const DEFAULT_RESPONSE_BODY_LIMIT = 2000;

function normalizeAllowedHosts(allowedHosts: string[]): Set<string> {
  return new Set(allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
}

export function parseAllowedWebhookHosts(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedWebhookUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && normalizeAllowedHosts(allowedHosts).has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function redactWebhookText(input: unknown, maxLength = DEFAULT_RESPONSE_BODY_LIMIT): string {
  const value = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  const redacted = value
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/((?:access_)?token|secret|api[_-]?key|password)=([^\s&;]+)/gi, '$1=[redacted]')
    .replace(/((?:access_)?token|secret|api[_-]?key|password)\s*:\s*([^\s,;}]+)/gi, '$1: [redacted]');

  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, maxLength)}…[truncated]`;
}

export function createFetchWebhookHttpClient(timeoutMs = 10000): WebhookHttpClient {
  return {
    async postJson(url, payload) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const body = await response.text();
        return { status: response.status, body };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function dispatchQueuedWebhooks(options: DispatchQueuedWebhooksOptions): Promise<WebhookDispatchSummary> {
  const limit = Math.max(1, Math.min(100, options.limit ?? DEFAULT_LIMIT));
  const responseBodyLimit = options.responseBodyLimit ?? DEFAULT_RESPONSE_BODY_LIMIT;
  const httpClient = options.httpClient ?? createFetchWebhookHttpClient();
  const deliveries = await options.repository.claimQueuedDeliveries(limit);
  const summary: WebhookDispatchSummary = { processed: 0, sent: 0, failed: 0, blocked: 0 };

  for (const delivery of deliveries) {
    summary.processed += 1;

    if (!isAllowedWebhookUrl(delivery.url, options.allowedHosts)) {
      await options.repository.markDeliveryFailed(delivery.id, {
        httpStatus: null,
        responseBody: redactWebhookText('Webhook URL not allowed by dispatcher allowlist', responseBodyLimit),
      });
      summary.failed += 1;
      summary.blocked += 1;
      continue;
    }

    try {
      const response = await httpClient.postJson(delivery.url, delivery.payload);
      const responseBody = redactWebhookText(response.body, responseBodyLimit);
      if (response.status >= 200 && response.status < 300) {
        await options.repository.markDeliverySent(delivery.id, { httpStatus: response.status, responseBody });
        summary.sent += 1;
      } else {
        await options.repository.markDeliveryFailed(delivery.id, { httpStatus: response.status, responseBody });
        summary.failed += 1;
      }
    } catch (error) {
      await options.repository.markDeliveryFailed(delivery.id, {
        httpStatus: null,
        responseBody: redactWebhookText(error instanceof Error ? error.message : String(error), responseBodyLimit),
      });
      summary.failed += 1;
    }
  }

  return summary;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rowToQueuedDelivery(row: Record<string, unknown>): QueuedWebhookDelivery {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string | undefined,
    webhookId: row.webhookId as string,
    webhookName: row.webhookName as string | undefined,
    url: row.url as string,
    eventType: row.eventType as string,
    payload: objectPayload(row.payload),
    status: 'queued',
    httpStatus: row.httpStatus as number | null,
    attempts: Number(row.attempts ?? 0),
    createdAt: row.createdAt as string,
    deliveredAt: row.deliveredAt as string | null | undefined,
    responseBody: row.responseBody as string | null | undefined,
  };
}

export function createPgWebhookDispatchRepository(databaseUrl: string): WebhookDispatchRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async claimQueuedDeliveries(limit) {
      const result = await pool.query(
        `select d.id, d.tenant_id as "tenantId", d.webhook_id as "webhookId", w.name as "webhookName", w.url,
                d.event_type as "eventType", d.payload, d.status::text as status, d.http_status as "httpStatus",
                d.attempts, d.response_body as "responseBody", d.delivered_at::text as "deliveredAt", d.created_at::text as "createdAt"
           from webhook_deliveries d
           join webhooks w on w.tenant_id = d.tenant_id and w.id = d.webhook_id
          where d.status = 'queued'
            and (d.next_retry_at is null or d.next_retry_at <= now())
            and w.status = 'active'
          order by d.created_at asc
          limit $1`,
        [Math.max(1, Math.min(100, limit))],
      );
      return result.rows.map(rowToQueuedDelivery);
    },

    async markDeliverySent(id, result) {
      await pool.query(
        `update webhook_deliveries
            set status = 'sent', http_status = $2, response_body = $3, attempts = attempts + 1,
                delivered_at = now(), next_retry_at = null
          where id = $1`,
        [id, result.httpStatus, result.responseBody],
      );
    },

    async markDeliveryFailed(id, result) {
      await pool.query(
        `update webhook_deliveries
            set status = 'failed', http_status = $2, response_body = $3, attempts = attempts + 1,
                delivered_at = null, next_retry_at = null
          where id = $1`,
        [id, result.httpStatus, result.responseBody],
      );
    },

    async close() {
      await pool.end();
    },
  };
}
