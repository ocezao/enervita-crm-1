import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { CreateNotificationInput, Notification, NotificationsRepository, NotificationRuleRunResult } from '../modules/notifications/repository.ts';

const SESSION_SECRET = 'test-secret-with-at-least-32-characters';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: ['admin'],
    permissions: [],
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

function makeNotificationsRepository(result: NotificationRuleRunResult): NotificationsRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async create(_input: CreateNotificationInput): Promise<Notification> {
      throw new Error('not used');
    },
    async listForUser() {
      return { notifications: [], unreadCount: 0 };
    },
    async markAsRead() {
      return null;
    },
    async markAllAsRead() {
      return 0;
    },
    async runCommercialRules(tenantId: string) {
      calls.push(tenantId);
      return result;
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' },
  });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('POST /api/notifications/run-rules runs commercial notification rules for admins', async (t) => {
  const actor = makeAuthUser();
  const expected: NotificationRuleRunResult = {
    created: {
      task_overdue: 1,
      lead_without_next_action: 2,
      proposal_no_response: 3,
      opportunity_stale: 4,
      lead_stale: 0,
      seller_inactive: 0,
    },
    totalCreated: 10,
  };
  const notificationsRepository = makeNotificationsRepository(expected);
  const app = createApp({ userRepository: makeUserRepository(actor), notificationsRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/notifications/run-rules', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), expected);
  assert.deepEqual(notificationsRepository.calls, [TENANT_ID]);
});

test('POST /api/notifications/run-rules rejects non-admin users', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['notification.view'] });
  const notificationsRepository = makeNotificationsRepository({
    created: { task_overdue: 0, lead_without_next_action: 0, proposal_no_response: 0, opportunity_stale: 0, lead_stale: 0, seller_inactive: 0 },
    totalCreated: 0,
  });
  const app = createApp({ userRepository: makeUserRepository(actor), notificationsRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/notifications/run-rules', headers: { cookie } });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(notificationsRepository.calls, []);
});
