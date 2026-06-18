import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import { N8nUnavailableError } from '../modules/integrations/repository.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';

const SESSION_SECRET = 'test-secret-automations-webhooks-1234567890';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Operador Integrações',
    email: 'integracoes@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: [],
    permissions: ['page.automations', 'page.webhooks', 'webhook.test'],
    allowedStages: [],
    ...overrides,
  };
}

function makeUserRepository(user: TestUser | null): UserRepository {
  return {
    async findActiveUserByEmail(email: string) {
      return user && user.status === 'active' && user.email.toLowerCase() === email.toLowerCase() ? user : null;
    },
    async findActiveUserById(id: string) {
      return user && user.status === 'active' && user.id === id ? user : null;
    },
    async recordLogin() {},
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: { email: 'integracoes@enervita.com.br', password: 'SenhaSegura123!' } });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('GET /api/automations requires page.automations and returns operational automation catalog', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/automations', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(Array.isArray(body.automations));
  assert.ok(body.automations.some((rule: { id: string; trigger: string; status: string }) => rule.id === 'lead-no-followup-12h' && rule.trigger === 'lead.no_followup_12h' && rule.status === 'planned'));
});

test('GET /api/automations/n8n-workflows degrades when operational integration is unavailable', async (t) => {
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    sessionSecret: SESSION_SECRET,
    integrationsRepository: {
      async listAutomations() { return []; },
      async listWebhooks() { return []; },
      async listN8nWorkflows() { throw new N8nUnavailableError('Integração operacional ainda não está conectada ao CRM.'); },
      async setN8nWorkflowActive() { throw new Error('not used'); },
      async listWebhookDeliveries() { return []; },
      async runAutomation() { throw new Error('not used'); },
      async testWebhook() { throw new Error('not used'); },
      async close() {},
    },
  });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/automations/n8n-workflows', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().workflows, []);
  assert.match(response.json().message, /Integração operacional/);
});

test('GET /api/webhooks requires page.webhooks and returns webhook catalog without secrets', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/webhooks', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.webhooks.some((webhook: { id: string; status: string; secretConfigured: boolean; url: string }) => webhook.id === 'n8n-lead-created' && webhook.status === 'planned' && webhook.secretConfigured === false && !webhook.url.includes('token')));
});

test('POST /api/webhooks/:id/test requires webhook.test and records a controlled queued delivery', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/webhooks/n8n-lead-created/test', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.success, true);
  assert.equal(response.json().result.delivery.status, 'queued');
  assert.doesNotMatch(response.json().result.message, /dry-run/i);
});

test('GET /api/webhooks rejects authenticated users without page.webhooks', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser({ permissions: ['page.automations'] })), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/webhooks', headers: { cookie } });

  assert.equal(response.statusCode, 403);
});


test('POST /api/automations/:id/run requires automation.manage and records a real controlled automation run', async (t) => {
  const calls: string[] = [];
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser({ permissions: ['page.automations', 'automation.manage'] })),
    sessionSecret: SESSION_SECRET,
    integrationsRepository: {
      async listAutomations() { return []; },
      async listWebhooks() { return []; },
      async listN8nWorkflows() { return []; },
      async setN8nWorkflowActive() { throw new Error('not used'); },
      async listWebhookDeliveries() { return []; },
      async runAutomation(context, id, inputPayload) {
        calls.push(`${context.tenantId}:${id}:${inputPayload.reason}`);
        return {
          id: 'run-1',
          automationId: id,
          status: 'success',
          inputPayload,
          outputPayload: { queuedWebhookDeliveries: 1 },
          startedAt: '2026-05-29T10:00:00.000Z',
          finishedAt: '2026-05-29T10:00:01.000Z',
        };
      },
      async testWebhook() { throw new Error('not used'); },
      async close() {},
    },
  });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/automations/lead-no-followup-12h/run',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { reason: 'homologacao-controlada' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().run.status, 'success');
  assert.deepEqual(calls, [`${TENANT_ID}:lead-no-followup-12h:homologacao-controlada`]);
});

test('POST /api/webhooks/:id/test records a queued test delivery instead of dry-run-only text', async (t) => {
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser({ permissions: ['webhook.test'] })),
    sessionSecret: SESSION_SECRET,
    integrationsRepository: {
      async listAutomations() { return []; },
      async listWebhooks() { return []; },
      async listN8nWorkflows() { return []; },
      async setN8nWorkflowActive() { throw new Error('not used'); },
      async listWebhookDeliveries() { return []; },
      async runAutomation() { throw new Error('not used'); },
      async testWebhook(context, id) {
        return {
          success: true,
          message: 'Entrega de teste registrada na fila controlada; nenhum HTTP externo foi chamado.',
          delivery: {
            id: 'delivery-1',
            webhookId: id,
            eventType: 'webhook.test',
            status: 'queued',
            httpStatus: null,
            attempts: 0,
            createdAt: '2026-05-29T10:00:00.000Z',
          },
          contextTenantId: context.tenantId,
        };
      },
      async close() {},
    },
  });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/webhooks/n8n-lead-created/test', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.delivery.status, 'queued');
  assert.equal(response.json().result.contextTenantId, TENANT_ID);
  assert.doesNotMatch(response.json().result.message, /dry-run/i);
});

test('GET /api/webhooks/deliveries returns recent controlled delivery logs', async (t) => {
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser({ permissions: ['page.webhooks'] })),
    sessionSecret: SESSION_SECRET,
    integrationsRepository: {
      async listAutomations() { return []; },
      async listWebhooks() { return []; },
      async listN8nWorkflows() { return []; },
      async setN8nWorkflowActive() { throw new Error("not used"); },
      async listWebhookDeliveries(context) {
        return [{
          id: 'delivery-1',
          webhookId: 'n8n-lead-created',
          webhookName: 'n8n - lead criado',
          eventType: 'webhook.test',
          status: 'queued',
          httpStatus: null,
          attempts: 0,
          createdAt: '2026-05-29T10:00:00.000Z',
          deliveredAt: null,
          responseBody: null,
          tenantId: context.tenantId,
        }];
      },
      async runAutomation() { throw new Error('not used'); },
      async testWebhook() { throw new Error('not used'); },
      async close() {},
    },
  });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/webhooks/deliveries', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().deliveries[0].status, 'queued');
  assert.equal(response.json().deliveries[0].tenantId, TENANT_ID);
});
