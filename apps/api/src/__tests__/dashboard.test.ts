import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { DashboardFilters, DashboardMetrics, DashboardRepository } from '../modules/dashboard/repository.ts';

const SESSION_SECRET = 'test-secret-dashboard-1234567890';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Operador Dashboard',
    email: 'dashboard@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: [],
    permissions: ['page.dashboard'],
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

function makeMetrics(): DashboardMetrics {
  return {
    newLeadsToday: 3,
    leadsWithoutFollowup: 2,
    overdueTasks: 1,
    openProposals: 4,
    leadsBySource: [{ source: 'site', count: 3 }],
    leadsByStage: [{ stage: 'novo_lead', count: 2 }, { stage: 'proposta_enviada', count: 1 }],
    conversionsByPlatform: [{ platform: 'meta', count: 2 }],
      leadsBySeller: [{ name: 'Cleyton', count: 2 }],
    commercial: {
      openOpportunityValue: 10000,
      wonOpportunityValue: 5000,
      openOpportunities: 2,
      wonOpportunities: 1,
      openProposals: 3,
      acceptedProposals: 1,
      acceptedProposalAnnualValue: 2400,
      overdueTasks: 1,
      leadsWithoutNextAction: 2,
      staleLeads: 1,
      stageBreakdown: [{ stage: 'novo_lead', count: 2, value: 10000, dropOff: undefined }],
      attentionLeads: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Lead Atenção', stage: 'novo_lead', reason: 'Sem próxima ação', updatedAt: '2026-05-29T12:00:00.000Z', nextActionAt: null }],
    },
    recentEvents: [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: TENANT_ID,
      leadId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      contactId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId: '11111111-1111-4111-8111-111111111111',
      activityType: 'note',
      outcome: 'Atividade real do dashboard',
      responseTimeSeconds: null,
      notes: 'Resumo recente',
      occurredAt: '2026-05-29T12:00:00.000Z',
      createdAt: '2026-05-29T12:00:00.000Z',
      leadStage: 'novo_lead',
    }],
  };
}

function makeDashboardRepository(calls: Array<{ tenantId: string; allowedStages: string[] | null; filters?: DashboardFilters }>): DashboardRepository {
  return {
    async getMetrics(tenantId, allowedStages, filters) {
      calls.push({ tenantId, allowedStages, filters });
      return makeMetrics();
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: { email: 'dashboard@enervita.com.br', password: 'SenhaSegura123!' } });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('GET /api/dashboard requires page.dashboard and returns real metrics scoped by allowed stages', async (t) => {
  const calls: Array<{ tenantId: string; allowedStages: string[] | null; filters?: DashboardFilters }> = [];
  const actor = makeAuthUser();
  const app = createApp({ userRepository: makeUserRepository(actor), dashboardRepository: makeDashboardRepository(calls), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({
    method: 'GET',
    url: '/api/dashboard?startDate=2026-05-01&endDate=2026-05-31&stage=proposta_enviada&source=site&platform=meta&activityType=call',
    headers: { cookie },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{
    tenantId: TENANT_ID,
    allowedStages: ['novo_lead', 'proposta_enviada'],
    filters: {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      stage: 'proposta_enviada',
      source: 'site',
      platform: 'meta',
      activityType: 'call',
    },
  }]);
  assert.equal(response.json().metrics.newLeadsToday, 3);
  assert.equal(response.json().metrics.recentEvents[0].outcome, 'Atividade real do dashboard');
});

test('GET /api/dashboard rejects authenticated users without page.dashboard', async (t) => {
  const actor = makeAuthUser({ permissions: ['lead.view'] });
  const app = createApp({ userRepository: makeUserRepository(actor), dashboardRepository: makeDashboardRepository([]), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie } });

  assert.equal(response.statusCode, 403);
});
