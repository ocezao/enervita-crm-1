import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dispatchQueuedWebhooks,
  isAllowedWebhookUrl,
  redactWebhookText,
  type QueuedWebhookDelivery,
  type WebhookDispatchRepository,
} from '../modules/integrations/webhookDispatcher.ts';

function queuedDelivery(overrides: Partial<QueuedWebhookDelivery> = {}): QueuedWebhookDelivery {
  return {
    id: 'delivery-1',
    tenantId: '22222222-2222-4222-8222-222222222222',
    webhookId: 'n8n-lead-created',
    webhookName: 'n8n - lead criado',
    url: 'https://n8n.enervita.com.br/webhook/lead-created',
    eventType: 'lead.created',
    payload: { leadId: 'lead-1', source: 'crm-preview-test' },
    status: 'queued',
    httpStatus: null,
    attempts: 0,
    createdAt: '2026-05-29T10:00:00.000Z',
    deliveredAt: null,
    responseBody: null,
    ...overrides,
  };
}

test('isAllowedWebhookUrl only allows HTTPS URLs whose host is explicitly allowlisted', () => {
  assert.equal(isAllowedWebhookUrl('https://n8n.enervita.com.br/webhook/lead-created', ['n8n.enervita.com.br']), true);
  assert.equal(isAllowedWebhookUrl('http://n8n.enervita.com.br/webhook/lead-created', ['n8n.enervita.com.br']), false);
  assert.equal(isAllowedWebhookUrl('https://evil.example/webhook/lead-created', ['n8n.enervita.com.br']), false);
  assert.equal(isAllowedWebhookUrl('not-a-url', ['n8n.enervita.com.br']), false);
});

test('redactWebhookText removes tokens and truncates unsafe network output', () => {
  const unsafe = `Authorization: Bearer super-secret-token token=abc123 access_token=xyz api_key=key123 password=pass123 ${'x'.repeat(5000)}`;
  const redacted = redactWebhookText(unsafe, 240);

  assert.doesNotMatch(redacted, /super-secret-token|abc123|xyz|key123|pass123/);
  assert.match(redacted, /\[redacted\]/);
  assert.ok(redacted.length <= 260);
});

test('dispatchQueuedWebhooks sends queued deliveries to allowed n8n URLs and marks them sent', async () => {
  const delivery = queuedDelivery();
  const updates: Array<{ type: 'sent' | 'failed'; payload: Record<string, unknown> }> = [];
  const calls: Array<{ url: string; payload: Record<string, unknown> }> = [];
  const repository: WebhookDispatchRepository = {
    async claimQueuedDeliveries(limit) {
      assert.equal(limit, 5);
      return [delivery];
    },
    async markDeliverySent(id, result) {
      assert.equal(id, delivery.id);
      updates.push({ type: 'sent', payload: result as unknown as Record<string, unknown> });
    },
    async markDeliveryFailed(id, result) {
      updates.push({ type: 'failed', payload: { id, ...result } });
    },
  };

  const summary = await dispatchQueuedWebhooks({
    repository,
    allowedHosts: ['n8n.enervita.com.br'],
    limit: 5,
    httpClient: {
      async postJson(url, payload) {
        calls.push({ url, payload });
        return { status: 200, body: 'ok' };
      },
    },
  });

  assert.deepEqual(summary, { processed: 1, sent: 1, failed: 0, blocked: 0 });
  assert.deepEqual(calls, [{ url: delivery.url, payload: delivery.payload }]);
  assert.equal(updates[0].type, 'sent');
  assert.equal(updates[0].payload.httpStatus, 200);
  assert.equal(updates[0].payload.responseBody, 'ok');
});

test('dispatchQueuedWebhooks blocks URLs outside allowlist without making an HTTP call', async () => {
  const delivery = queuedDelivery({ url: 'https://evil.example/webhook/lead-created?token=abc123' });
  const failures: Record<string, unknown>[] = [];
  let httpCalls = 0;
  const repository: WebhookDispatchRepository = {
    async claimQueuedDeliveries() {
      return [delivery];
    },
    async markDeliverySent() {
      throw new Error('should not mark sent');
    },
    async markDeliveryFailed(id, result) {
      failures.push({ id, ...result });
    },
  };

  const summary = await dispatchQueuedWebhooks({
    repository,
    allowedHosts: ['n8n.enervita.com.br'],
    httpClient: {
      async postJson() {
        httpCalls += 1;
        return { status: 200, body: 'should not happen' };
      },
    },
  });

  assert.deepEqual(summary, { processed: 1, sent: 0, failed: 1, blocked: 1 });
  assert.equal(httpCalls, 0);
  assert.equal(failures[0].httpStatus, null);
  assert.match(String(failures[0].responseBody), /not allowed/i);
  assert.doesNotMatch(String(failures[0].responseBody), /abc123/);
});

test('dispatchQueuedWebhooks marks non-2xx and network failures as failed with redacted details', async () => {
  const deliveries = [
    queuedDelivery({ id: 'delivery-500' }),
    queuedDelivery({ id: 'delivery-network' }),
  ];
  const failures: Record<string, unknown>[] = [];
  const repository: WebhookDispatchRepository = {
    async claimQueuedDeliveries() {
      return deliveries;
    },
    async markDeliverySent() {
      throw new Error('should not mark sent');
    },
    async markDeliveryFailed(id, result) {
      failures.push({ id, ...result });
    },
  };

  const summary = await dispatchQueuedWebhooks({
    repository,
    allowedHosts: ['n8n.enervita.com.br'],
    httpClient: {
      async postJson() {
        if (failures.length === 0) return { status: 500, body: 'server says token=abc123' };
        throw new Error('request failed Authorization: Bearer secret-token');
      },
    },
  });

  assert.deepEqual(summary, { processed: 2, sent: 0, failed: 2, blocked: 0 });
  assert.equal(failures[0].httpStatus, 500);
  assert.equal(failures[1].httpStatus, null);
  assert.doesNotMatch(String(failures[0].responseBody), /abc123/);
  assert.doesNotMatch(String(failures[1].responseBody), /secret-token/);
  assert.match(String(failures[0].responseBody), /\[redacted\]/);
  assert.match(String(failures[1].responseBody), /\[redacted\]/);
});
