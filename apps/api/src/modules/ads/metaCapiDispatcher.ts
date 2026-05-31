import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

type JsonObject = Record<string, unknown>;

export type QueuedMetaTrackingEvent = {
  id: string;
  tenantId: string;
  leadId: string | null;
  eventName: string;
  payload: JsonObject;
  attempts: number;
  createdAt: string;
  contact?: {
    email: string | null;
    phone: string | null;
    name?: string | null;
    metadata?: JsonObject;
    consent: boolean;
  };
};

export type MetaCapiEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: 'system_generated';
  user_data: Record<string, string>;
  custom_data: JsonObject;
};

export type MetaCapiHttpResponse = {
  status: number;
  body: string;
};

export type MetaCapiHttpClient = {
  postEvents(url: string, payload: Record<string, unknown>, accessToken: string): Promise<MetaCapiHttpResponse>;
};

export type MetaDispatchRepository = {
  claimQueuedMetaEvents(limit: number): Promise<QueuedMetaTrackingEvent[]>;
  markMetaEventSent(id: string, responseBody: string): Promise<void>;
  markMetaEventFailed(id: string, errorMessage: string): Promise<void>;
  close?(): Promise<void>;
};

export type MetaDispatchSummary = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type DispatchQueuedMetaEventsOptions = {
  repository: MetaDispatchRepository;
  httpClient?: MetaCapiHttpClient;
  accessToken: string;
  datasetId: string;
  graphApiVersion: string;
  limit?: number;
  testEventCode?: string;
  responseBodyLimit?: number;
};

const DEFAULT_LIMIT = 25;
const DEFAULT_RESPONSE_BODY_LIMIT = 2000;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizedPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return null;
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) return `55${digits}`;
  return digits;
}

function normalizedText(value: string | null | undefined): string | null {
  const text = value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ');
  return text || null;
}

function nameParts(value: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const text = normalizedText(value);
  if (!text) return { firstName: null, lastName: null };
  const parts = text.split(' ').filter(Boolean);
  return { firstName: parts[0] ?? null, lastName: parts.length > 1 ? parts[parts.length - 1] : null };
}

function metadataString(metadata: JsonObject, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function numericValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function eventTimestampSeconds(value: string): number {
  const parsed = new Date(value).getTime();
  return Math.floor((Number.isFinite(parsed) ? parsed : Date.now()) / 1000);
}

export function redactMetaText(input: unknown, maxLength = DEFAULT_RESPONSE_BODY_LIMIT): string {
  const value = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  const redacted = value
    .replace(/(access_token=)[^&\s]+/gi, '$1[redacted]')
    .replace(/((?:access_)?token|secret|api[_-]?key|password)=([^\s&;]+)/gi, '$1=[redacted]')
    .replace(/((?:access_)?token|secret|api[_-]?key|password)\s*:\s*([^\s,;}]+)/gi, '$1: [redacted]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[redacted]');
  return redacted.length <= maxLength ? redacted : `${redacted.slice(0, maxLength)}…[truncated]`;
}

export function buildMetaCapiEvent(event: QueuedMetaTrackingEvent): MetaCapiEvent {
  const payload = objectValue(event.payload);
  const attribution = objectValue(payload.attribution);
  const utm = objectValue(payload.utm);
  const request = objectValue(payload.request);
  const location = objectValue(payload.location);
  const contact = event.contact ?? { email: null, phone: null, name: null, metadata: {}, consent: false };
  const contactMetadata = objectValue(contact.metadata);
  const userData: Record<string, string> = {};

  const externalIdSource = event.leadId ?? stringValue(payload.leadId) ?? event.id;
  userData.external_id = sha256(externalIdSource);

  const fbp = stringValue(attribution.fbp) ?? metadataString(contactMetadata, 'fbp');
  const fbclid = stringValue(attribution.fbclid) ?? metadataString(contactMetadata, 'fbclid');
  const fbc = stringValue(attribution.fbc) ?? metadataString(contactMetadata, 'fbc') ?? (fbclid ? `fb.1.${eventTimestampSeconds(event.createdAt)}.${fbclid}` : null);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const clientIpAddress = stringValue(request.clientIpAddress) ?? stringValue(request.client_ip_address);
  const clientUserAgent = stringValue(request.clientUserAgent) ?? stringValue(request.client_user_agent) ?? stringValue(request.userAgent);
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  if (contact.consent) {
    const email = normalizedEmail(contact.email);
    const phone = normalizedPhone(contact.phone);
    const { firstName, lastName } = nameParts(contact.name);
    const city = normalizedText(stringValue(location.city) ?? metadataString(contactMetadata, 'city', 'cidade'));
    const state = normalizedText(stringValue(location.state) ?? metadataString(contactMetadata, 'state', 'estado'));
    const country = normalizedText(stringValue(location.country) ?? metadataString(contactMetadata, 'country', 'pais') ?? 'br');
    if (email) userData.em = sha256(email);
    if (phone) userData.ph = sha256(phone);
    if (firstName) userData.fn = sha256(firstName);
    if (lastName) userData.ln = sha256(lastName);
    if (city) userData.ct = sha256(city);
    if (state) userData.st = sha256(state);
    if (country) userData.country = sha256(country);
  }

  const estimatedTicket = numericValue(payload.estimatedTicket);
  const customData: JsonObject = {
    lead_id: event.leadId ?? stringValue(payload.leadId) ?? undefined,
    action: stringValue(payload.action) ?? undefined,
    stage: stringValue(payload.stage) ?? undefined,
    from_stage: stringValue(payload.fromStage) ?? undefined,
    transition_direction: stringValue(payload.transitionDirection) ?? undefined,
    source: stringValue(payload.source) ?? undefined,
    priority: stringValue(payload.priority) ?? undefined,
    tags: stringArray(payload.tags),
    utm_source: stringValue(utm.source) ?? undefined,
    utm_medium: stringValue(utm.medium) ?? undefined,
    utm_campaign: stringValue(utm.campaign) ?? undefined,
    utm_content: stringValue(utm.content) ?? undefined,
    utm_term: stringValue(utm.term) ?? undefined,
    fbclid_present: Boolean(stringValue(attribution.fbclid)),
    gclid_present: Boolean(stringValue(attribution.gclid) ?? metadataString(contactMetadata, 'gclid')),
    event_source: 'crm',
    lead_event_source: stringValue(payload.leadEventSource) ?? 'Enervita Custom CRM',
  };
  if (estimatedTicket !== undefined) customData.value = estimatedTicket;
  customData.currency = 'BRL';

  for (const [key, value] of Object.entries(customData)) {
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) delete customData[key];
  }

  return {
    event_name: event.eventName,
    event_time: eventTimestampSeconds(event.createdAt),
    event_id: `crm:${event.id}`,
    action_source: 'system_generated',
    user_data: userData,
    custom_data: customData,
  };
}

export function createFetchMetaCapiHttpClient(timeoutMs = 12000): MetaCapiHttpClient {
  return {
    async postEvents(url, payload, accessToken) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${url}?access_token=${encodeURIComponent(accessToken)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return { status: response.status, body: await response.text() };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function dispatchQueuedMetaEvents(options: DispatchQueuedMetaEventsOptions): Promise<MetaDispatchSummary> {
  const accessToken = options.accessToken.trim();
  const datasetId = options.datasetId.trim();
  const graphApiVersion = options.graphApiVersion.trim() || 'v23.0';
  if (!accessToken || !datasetId) return { processed: 0, sent: 0, failed: 0, skipped: 1 };

  const limit = Math.max(1, Math.min(100, options.limit ?? DEFAULT_LIMIT));
  const responseBodyLimit = options.responseBodyLimit ?? DEFAULT_RESPONSE_BODY_LIMIT;
  const url = `https://graph.facebook.com/${graphApiVersion}/${datasetId}/events`;
  const httpClient = options.httpClient ?? createFetchMetaCapiHttpClient();
  const events = await options.repository.claimQueuedMetaEvents(limit);
  const summary: MetaDispatchSummary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  for (const event of events) {
    summary.processed += 1;
    const capiPayload: Record<string, unknown> = { data: [buildMetaCapiEvent(event)] };
    if (options.testEventCode?.trim()) capiPayload.test_event_code = options.testEventCode.trim();

    try {
      const response = await httpClient.postEvents(url, capiPayload, accessToken);
      const responseBody = redactMetaText(response.body, responseBodyLimit);
      if (response.status >= 200 && response.status < 300) {
        await options.repository.markMetaEventSent(event.id, responseBody);
        summary.sent += 1;
      } else {
        await options.repository.markMetaEventFailed(event.id, `HTTP ${response.status}: ${responseBody}`);
        summary.failed += 1;
      }
    } catch (error) {
      await options.repository.markMetaEventFailed(event.id, redactMetaText(error instanceof Error ? error.message : String(error), responseBodyLimit));
      summary.failed += 1;
    }
  }

  return summary;
}

function rowToQueuedMetaEvent(row: Record<string, unknown>): QueuedMetaTrackingEvent {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    leadId: row.leadId as string | null,
    eventName: row.eventName as string,
    payload: objectValue(row.payload),
    attempts: Number(row.attempts ?? 0),
    createdAt: row.createdAt as string,
    contact: {
      email: row.contactEmail as string | null,
      phone: row.contactPhone as string | null,
      name: row.contactName as string | null,
      metadata: objectValue(row.contactMetadata),
      consent: row.contactConsent === true,
    },
  };
}

export function createPgMetaDispatchRepository(databaseUrl: string, maxAttempts = 3): MetaDispatchRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  const cappedMaxAttempts = Math.max(1, maxAttempts);

  return {
    async claimQueuedMetaEvents(limit) {
      const result = await pool.query(
        `select te.id, te.tenant_id as "tenantId", te.lead_id as "leadId", te.event_name as "eventName",
                te.payload, te.attempts, te.created_at::text as "createdAt",
                c.email as "contactEmail", c.phone as "contactPhone", c.name as "contactName", c.metadata as "contactMetadata", coalesce(c.consent, false) as "contactConsent"
           from tracking_events te
           left join leads l on l.tenant_id = te.tenant_id and l.id = te.lead_id
           left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
          where te.platform = 'meta'
            and te.status = 'queued'
            and (te.next_retry_at is null or te.next_retry_at <= now())
          order by te.created_at asc
          limit $1`,
        [Math.max(1, Math.min(100, limit))],
      );
      return result.rows.map(rowToQueuedMetaEvent);
    },

    async markMetaEventSent(id, responseBody) {
      await pool.query(
        `update tracking_events
            set status = 'sent', attempts = attempts + 1, sent_at = now(), next_retry_at = null,
                error_message = null, payload = jsonb_set(payload, '{meta_response}', to_jsonb($2::text), true), updated_at = now()
          where id = $1`,
        [id, redactMetaText(responseBody)],
      );
    },

    async markMetaEventFailed(id, errorMessage) {
      await pool.query(
        `update tracking_events
            set attempts = attempts + 1,
                status = case when attempts + 1 >= $2 then 'failed'::delivery_status else 'queued'::delivery_status end,
                error_message = $3,
                next_retry_at = case when attempts + 1 >= $2 then null else now() + interval '15 minutes' end,
                updated_at = now()
          where id = $1`,
        [id, cappedMaxAttempts, redactMetaText(errorMessage)],
      );
    },

    async close() {
      await pool.end();
    },
  };
}
