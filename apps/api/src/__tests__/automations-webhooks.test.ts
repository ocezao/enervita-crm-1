import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
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

test('GET /api/webhooks requires page.webhooks and returns webhook catalog without secrets', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/webhooks', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.webhooks.some((webhook: { id: string; status: string; secretConfigured: boolean; url: string }) => webhook.id === 'n8n-lead-created' && webhook.status === 'planned' && webhook.secretConfigured === false && !webhook.url.includes('token')));
});

test('POST /api/webhooks/:id/test requires webhook.test and performs dry-run validation only', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/webhooks/n8n-lead-created/test', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.success, true);
  assert.match(response.json().result.message, /dry-run/i);
});

test('GET /api/webhooks rejects authenticated users without page.webhooks', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser({ permissions: ['page.automations'] })), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/webhooks', headers: { cookie } });

  assert.equal(response.statusCode, 403);
});
