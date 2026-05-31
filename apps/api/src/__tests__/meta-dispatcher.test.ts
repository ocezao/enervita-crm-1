import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMetaCapiEvent,
  dispatchQueuedMetaEvents,
  redactMetaText,
  type MetaCapiHttpClient,
  type MetaDispatchRepository,
  type QueuedMetaTrackingEvent,
} from '../modules/ads/metaCapiDispatcher.ts';

const baseEvent: QueuedMetaTrackingEvent = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: '22222222-2222-4222-8222-222222222222',
  leadId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  eventName: 'EnervitaQualifiedLead',
  payload: {
    action: 'stage_changed',
    leadId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    stage: 'diagnostico',
    fromStage: 'conta_recebida',
    source: 'meta_ads',
    utm: { source: 'facebook', campaign: 'solar-sp-capital' },
    request: { clientIpAddress: '203.0.113.10', clientUserAgent: 'Hermes QA Browser' },
    location: { city: 'São Paulo', state: 'SP', country: 'BR' },
    leadEventSource: 'Enervita Custom CRM',
    attribution: { fbp: 'fb.1.1710000000.123', fbc: 'fb.1.1710000000.ABC' },
    tags: ['vip', 'urgente'],
    priority: 'alta',
    estimatedTicket: '2500',
  },
  attempts: 0,
  createdAt: '2026-05-31T12:00:00.000Z',
  contact: {
    email: ' Cliente@Example.COM ',
    phone: '+55 (11) 99999-0000',
    name: 'Cliente Solar Teste',
    metadata: { city: 'São Paulo', state: 'SP' },
    consent: true,
  },
};

function makeRepository(events: QueuedMetaTrackingEvent[]): MetaDispatchRepository & { sent: string[]; failed: string[] } {
  return {
    sent: [],
    failed: [],
    async claimQueuedMetaEvents() {
      return events;
    },
    async markMetaEventSent(id) {
      this.sent.push(id);
    },
    async markMetaEventFailed(id) {
      this.failed.push(id);
    },
  };
}

test('buildMetaCapiEvent creates a production-safe CAPI payload with hashed user data and CRM custom data', () => {
  const event = buildMetaCapiEvent(baseEvent);

  assert.equal(event.event_name, 'EnervitaQualifiedLead');
  assert.equal(event.event_id, `crm:${baseEvent.id}`);
  assert.equal(event.action_source, 'system_generated');
  assert.equal(event.event_time, 1780228800);
  assert.equal(event.user_data.fbp, 'fb.1.1710000000.123');
  assert.equal(event.user_data.fbc, 'fb.1.1710000000.ABC');
  assert.match(String(event.user_data.em), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.ph), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.external_id), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.fn), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.ln), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.ct), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.st), /^[a-f0-9]{64}$/);
  assert.match(String(event.user_data.country), /^[a-f0-9]{64}$/);
  assert.equal(event.user_data.client_ip_address, '203.0.113.10');
  assert.equal(event.user_data.client_user_agent, 'Hermes QA Browser');
  assert.equal(event.custom_data.stage, 'diagnostico');
  assert.equal(event.custom_data.from_stage, 'conta_recebida');
  assert.deepEqual(event.custom_data.tags, ['vip', 'urgente']);
  assert.equal(event.custom_data.utm_campaign, 'solar-sp-capital');
  assert.equal(event.custom_data.event_source, 'crm');
  assert.equal(event.custom_data.lead_event_source, 'Enervita Custom CRM');
});

test('dispatchQueuedMetaEvents posts queued events and marks them sent without exposing tokens', async () => {
  const repository = makeRepository([baseEvent]);
  const calls: Array<{ url: string; payload: Record<string, unknown>; accessToken: string }> = [];
  const httpClient: MetaCapiHttpClient = {
    async postEvents(url, payload, accessToken) {
      calls.push({ url, payload, accessToken });
      return { status: 200, body: '{"events_received":1}' };
    },
  };

  const summary = await dispatchQueuedMetaEvents({
    repository,
    httpClient,
    accessToken: 'SECRET_META_TOKEN',
    datasetId: '872374598469267',
    graphApiVersion: 'v23.0',
  });

  assert.deepEqual(summary, { processed: 1, sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(repository.sent, [baseEvent.id]);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v23.0/872374598469267/events');
  assert.equal((calls[0].payload.data as unknown[]).length, 1);
  assert.equal(JSON.stringify(calls[0].payload).includes('SECRET_META_TOKEN'), false);
});

test('dispatchQueuedMetaEvents fails safely when Meta returns an error and redacts sensitive text', async () => {
  const repository = makeRepository([baseEvent]);
  const httpClient: MetaCapiHttpClient = {
    async postEvents() {
      return { status: 400, body: 'bad access_token=SECRET_META_TOKEN password=abc' };
    },
  };

  const summary = await dispatchQueuedMetaEvents({
    repository,
    httpClient,
    accessToken: 'SECRET_META_TOKEN',
    datasetId: '872374598469267',
    graphApiVersion: 'v23.0',
  });

  assert.equal(summary.failed, 1);
  assert.deepEqual(repository.failed, [baseEvent.id]);
  assert.doesNotMatch(redactMetaText('bad access_token=SECRET_META_TOKEN password=abc'), /SECRET_META_TOKEN|password=abc/);
});

test('dispatchQueuedMetaEvents skips dispatch when token or dataset is missing', async () => {
  const repository = makeRepository([baseEvent]);
  const summary = await dispatchQueuedMetaEvents({
    repository,
    accessToken: '',
    datasetId: '',
    graphApiVersion: 'v23.0',
  });

  assert.deepEqual(summary, { processed: 0, sent: 0, failed: 0, skipped: 1 });
  assert.deepEqual(repository.sent, []);
  assert.deepEqual(repository.failed, []);
});
