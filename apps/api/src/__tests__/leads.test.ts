import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import type { PipelineStageKey } from '@enervita/shared';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { AuditContext } from '../modules/users/repository.ts';
import { LeadsNotFoundError, type Lead, type LeadsRepository } from '../modules/leads/repository.ts';
import type { CreateLeadInput, UpdateLeadInput } from '../modules/leads/validation.ts';

const SESSION_SECRET = 'test-session-secret-with-32-characters';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT_ID = '99999999-9999-4999-8999-999999999999';

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

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const id = overrides.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantId = overrides.tenantId ?? TENANT_ID;
  const stage = overrides.stage ?? 'novo_lead';
  return {
    id,
    tenantId,
    contactId: `contact-${id}`,
    stage,
    qualificationStatus: null,
    leadSource: 'site',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    estimatedTicket: null,
    sdrOwnerId: null,
    priority: 'media',
    notes: null,
    lostReason: null,
    metadata: {},
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    contact: {
      id: `contact-${id}`,
      name: 'Lead Teste',
      email: 'lead@example.com',
      phone: null,
      company: null,
      source: 'site',
      consent: true,
      metadata: {},
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z',
    },
    ...overrides,
  };
}

type FakeOptions = {
  onList?: (tenantId: string, allowedStages: PipelineStageKey[] | null) => void;
  onChangeStage?: (context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, targetStage: PipelineStageKey) => void;
};

function makeLeadsRepository(initialLeads: Lead[] = [makeLead()], options: FakeOptions = {}): LeadsRepository {
  const leads = initialLeads.map((lead) => ({ ...lead, contact: { ...lead.contact } }));
  const history: Array<{ tenantId: string; leadId: string; fromStage: PipelineStageKey; toStage: PipelineStageKey }> = [];

  function visible(lead: Lead, tenantId: string, allowedStages: PipelineStageKey[] | null) {
    return lead.tenantId === tenantId && (allowedStages === null || allowedStages.includes(lead.stage));
  }

  return {
    async listLeads(tenantId, allowedStages) {
      options.onList?.(tenantId, allowedStages);
      return leads.filter((lead) => visible(lead, tenantId, allowedStages));
    },
    async getLead(tenantId, leadId, allowedStages) {
      return leads.find((lead) => lead.id === leadId && visible(lead, tenantId, allowedStages)) ?? null;
    },
    async createLead(context, input: CreateLeadInput) {
      const lead = makeLead({
        id: 'created-created-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: context.tenantId,
        stage: input.stage,
        contact: { ...makeLead().contact, name: input.contact.name, email: input.contact.email ?? null },
      });
      leads.push(lead);
      history.push({ tenantId: context.tenantId, leadId: lead.id, fromStage: input.stage, toStage: input.stage });
      return lead;
    },
    async updateLead(context, leadId, allowedStages, input: UpdateLeadInput) {
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      if (input.notes !== undefined) lead.notes = input.notes;
      return lead;
    },
    async changeStage(context, leadId, allowedStages, targetStage) {
      options.onChangeStage?.(context, leadId, allowedStages, targetStage);
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      const fromStage = lead.stage;
      lead.stage = targetStage;
      history.push({ tenantId: context.tenantId, leadId, fromStage, toStage: targetStage });
      return lead;
    },
    async countStageHistory(tenantId, leadId) {
      return history.filter((row) => row.tenantId === tenantId && row.leadId === leadId).length;
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

test('GET /api/leads requires authentication', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/leads' });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Authentication required' });
});

test('GET /api/leads rejects authenticated users without lead.view', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: [], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 403);
});

test('GET /api/leads returns only allowed stages for non-admin users', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  let capturedStages: PipelineStageKey[] | null = null;
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead' }),
      makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'diagnostico' }),
    ], { onList: (_tenantId, allowedStages) => { capturedStages = allowedStages; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(response.json().leads.map((lead: Lead) => lead.stage), ['novo_lead']);
});

test('GET /api/leads returns all stages for admin users', async (t) => {
  let capturedStages: PipelineStageKey[] | null | undefined;
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    leadsRepository: makeLeadsRepository([
      makeLead({ stage: 'novo_lead' }),
      makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'diagnostico' }),
    ], { onList: (_tenantId, allowedStages) => { capturedStages = allowedStages; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedStages, null);
  assert.equal(response.json().leads.length, 2);
});

test('GET /api/leads/:id returns 404 for disallowed current stage without leaking existence', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'diagnostico' })]),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', headers: { cookie } });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'Lead not found' });
});

test('PATCH /api/leads/:id/stage requires lead.stage_change', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead', 'qualificacao'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stage',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { stage: 'qualificacao' },
  });

  assert.equal(response.statusCode, 403);
});

test('PATCH /api/leads/:id/stage rejects target stage outside allowedStages', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.stage_change'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stage',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { stage: 'qualificacao' },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.json().error, /not allowed/i);
});





test('POST /api/leads rejects invalid sdrOwnerId with 400', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/leads',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { contact: { name: 'Lead com SDR inválido' }, sdrOwnerId: 'not-a-uuid' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /sdrOwnerId.*valid UUID/);
});

test('POST /api/leads creating directly as perdido requires lead.mark_lost for non-admin', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.create'], allowedStages: ['perdido'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/leads',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { stage: 'perdido', contact: { name: 'Lead Perdido' } },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.json().error, /lead\.mark_lost/);
});

test('GET /api/leads/:id rejects invalid UUID params with 400', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads/not-a-uuid', headers: { cookie } });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /valid UUID/);
});

test('PATCH /api/leads/:id/stage moving to perdido requires lead.mark_lost for non-admin', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.stage_change'], allowedStages: ['novo_lead', 'perdido'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stage',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { stage: 'perdido', lostReason: 'Sem interesse' },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.json().error, /lead\.mark_lost/);
});

test('PATCH /api/leads/:id/stage writes lead_stage_history through repository', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.stage_change', 'lead.mark_lost'], allowedStages: ['novo_lead', 'qualificacao'] });
  const repository = makeLeadsRepository();
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: repository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stage',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { stage: 'qualificacao', notes: 'Contato realizado' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().lead.stage, 'qualificacao');
  assert.equal(await repository.countStageHistory?.(TENANT_ID, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1);
});

test('lead responses never expose password_hash or secrets', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const serialized = JSON.stringify(response.json()).toLowerCase();
  assert.equal(serialized.includes('password_hash'), false);
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('secret'), false);
});

test('GET /api/leads enforces tenant isolation', async (t) => {
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenantId: TENANT_ID }),
      makeLead({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', tenantId: OTHER_TENANT_ID }),
    ]),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().leads.map((lead: Lead) => lead.tenantId), [TENANT_ID]);
});
