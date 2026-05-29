import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { Proposal, ProposalsRepository, TrackingEventSummary } from '../modules/proposals/repository.ts';

const SESSION_SECRET = 'test-session-secret-1234567890';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const LEAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Operador Propostas',
    email: 'propostas@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: [],
    permissions: ['page.proposals', 'proposal.view', 'proposal.create', 'tracking.view'],
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

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    tenantId: TENANT_ID,
    leadId: LEAD_ID,
    title: 'Proposta João Mercado Solar',
    status: 'draft',
    monthlyBillValue: 2500,
    estimatedKwh: 1830,
    discountPercentage: 20,
    projectedMonthlySavings: 500,
    projectedAnnualSavings: 6000,
    validUntil: '2026-06-30T00:00:00.000Z',
    sentAt: null,
    acceptedAt: null,
    lostAt: null,
    lostReason: null,
    notes: null,
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    leadName: 'João Mercado',
    leadStage: 'diagnostico',
    ...overrides,
  };
}

function event(overrides: Partial<TrackingEventSummary> = {}): TrackingEventSummary {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    tenantId: TENANT_ID,
    leadId: LEAD_ID,
    platform: 'meta',
    eventName: 'Lead',
    status: 'sent',
    attempts: 1,
    sentAt: '2026-05-29T00:10:00.000Z',
    nextRetryAt: null,
    errorMessage: null,
    payload: { source: 'site' },
    createdAt: '2026-05-29T00:00:00.000Z',
    ...overrides,
  };
}

function makeProposalsRepository(): ProposalsRepository {
  const created: Proposal[] = [];
  const events = [event(), event({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', platform: 'google_ads', eventName: 'conversion' })];
  return {
    async listProposals() {
      return [proposal(), ...created];
    },
    async listProposalsForLead(_tenantId, leadId) {
      return [proposal({ leadId }), ...created.filter((item) => item.leadId === leadId)];
    },
    async createProposal(context, input) {
      const item = proposal({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        tenantId: context.tenantId,
        leadId: input.leadId,
        title: input.title,
        status: 'draft',
        monthlyBillValue: input.monthlyBillValue,
        estimatedKwh: input.estimatedKwh ?? null,
        discountPercentage: input.discountPercentage,
        projectedMonthlySavings: input.projectedMonthlySavings,
        projectedAnnualSavings: input.projectedAnnualSavings,
        validUntil: input.validUntil ?? null,
        notes: input.notes ?? null,
      });
      created.push(item);
      return item;
    },
    async listTrackingEventsForLead(_tenantId, leadId, options) {
      return events.filter((item) => {
        if (item.leadId !== leadId) return false;
        return !options?.excludePlatforms?.includes(item.platform);
      });
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: { email: 'propostas@enervita.com.br', password: 'SenhaSegura123!' } });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('GET /api/proposals returns native CRM proposals with page.proposals permission', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), proposalsRepository: makeProposalsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/proposals', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().proposals[0].title, 'Proposta João Mercado Solar');
});

test('GET /api/proposals rejects users without proposal permission', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser({ permissions: ['lead.view'] })), proposalsRepository: makeProposalsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/proposals', headers: { cookie } });

  assert.equal(response.statusCode, 403);
});

test('POST /api/proposals creates a native CRM proposal and keeps it in draft', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), proposalsRepository: makeProposalsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/proposals',
    headers: { cookie, 'content-type': 'application/json' },
    payload: {
      leadId: LEAD_ID,
      title: 'Proposta Comercial Enervita',
      monthlyBillValue: 3200,
      estimatedKwh: 2100,
      discountPercentage: 20,
      projectedMonthlySavings: 640,
      projectedAnnualSavings: 7680,
      validUntil: '2026-06-30T00:00:00.000Z',
      notes: 'Homologação comercial',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().proposal.status, 'draft');
  assert.equal(response.json().proposal.title, 'Proposta Comercial Enervita');
});

test('GET /api/leads/:id/tracking-events returns non-Google tracking events for homologation', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), proposalsRepository: makeProposalsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: `/api/leads/${LEAD_ID}/tracking-events`, headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().events.map((item: TrackingEventSummary) => item.platform), ['meta']);
});
