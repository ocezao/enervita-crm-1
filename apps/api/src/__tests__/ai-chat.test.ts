import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import { assertSafeAiSelect } from '../modules/ai/sqlGuard.ts';

const SESSION_SECRET='test-s...7890';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const aiSqlRunner = { async query() { return { rows: [] }; } };
const aiConfig = { provider: 'openrouter' as const, model: 'deepseek/deepseek-chat-v3-0324', apiKey: '', baseUrl: 'https://openrouter.ai/api/v1' };


type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Operador IA',
    email: 'ai@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: [],
    permissions: ['page.ai_assistant'],
    allowedStages: ['novo_lead', 'proposta_enviada'],
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
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: { email: 'ai@enervita.com.br', password: 'SenhaSegura123!' } });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('POST /api/ai/chat requires page.ai_assistant permission', async (t) => {
  const actor = makeAuthUser({ permissions: ['lead.view'] });
  const app = createApp({ userRepository: makeUserRepository(actor), sessionSecret: SESSION_SECRET, aiSqlRunner });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/ai/chat', headers: { cookie }, payload: { message: 'Quais leads estão parados?' } });

  assert.equal(response.statusCode, 403);
});

test('POST /api/ai/chat returns 503 when OpenRouter key is not configured and never asks the frontend for a key', async (t) => {
  const actor = makeAuthUser();
  const app = createApp({ userRepository: makeUserRepository(actor), sessionSecret: SESSION_SECRET, aiConfig, aiSqlRunner });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/ai/chat', headers: { cookie }, payload: { message: 'Resumo dos leads de hoje' } });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, 'LLM_NOT_CONFIGURED');
});

test('assertSafeAiSelect allows only bounded SELECT queries on CRM allowlisted tables', () => {
  assert.doesNotThrow(() => assertSafeAiSelect('select id, name from leads where tenant_id = $1 limit 20'));
  assert.throws(() => assertSafeAiSelect('update leads set stage = $1'), /Only SELECT/);
  assert.throws(() => assertSafeAiSelect('select * from users limit 5'), /not allowed/);
  assert.throws(() => assertSafeAiSelect('select * from leads'), /LIMIT/);
});
