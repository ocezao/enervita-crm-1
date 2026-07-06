import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import type { PipelineStageKey } from '@enervita/shared';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { AuditContext } from '../modules/users/repository.ts';
import { buildMetaStageEventPayloadForTest, queueMetaStageEventForTest, LeadsNotFoundError, type Lead, type LeadDocument, type LeadHistoryEvent, type LeadsRepository } from '../modules/leads/repository.ts';
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
    utmContent: null,
    utmTerm: null,
    fbp: null,
    fbc: null,
    fbclid: null,
    gclid: null,
    estimatedTicket: null,
    sdrOwnerId: '11111111-1111-4111-8111-111111111111',
    sdrOwner: 'Admin Enervita',
    nextActionAt: null,
    priority: 'media',
    notes: null,
    lostReason: null,
    metadata: {},
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    tags: [],
    opportunity: null,
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

type TestLeadHistoryEvent = LeadHistoryEvent;

type FakeOptions = {
  onList?: (tenantId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, filters?: unknown) => void;
  onCreate?: (context: AuditContext, input: CreateLeadInput) => void;
  onGetHistory?: (tenantId: string, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null) => void;
  onChangeStage?: (context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, targetStage: PipelineStageKey) => void;
  onSetTags?: (context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: { tags: string[] }) => void;
  onBulkSetTags?: (context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null, input: { tags: string[] }) => void;
  onDelete?: (context: AuditContext, leadId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null) => void;
  onBulkDelete?: (context: AuditContext, leadIds: string[], allowedStages: PipelineStageKey[] | null, ownerUserId: string | null) => void;
};

function makeLeadsRepository(initialLeads: Lead[] = [makeLead()], options: FakeOptions = {}, initialHistory: TestLeadHistoryEvent[] = []): LeadsRepository {
  const leads = initialLeads.map((lead) => ({ ...lead, contact: { ...lead.contact } }));
  const auditHistory = initialHistory.map((event) => ({ ...event, actor: event.actor ? { ...event.actor } : null, changes: event.changes.map((change) => ({ ...change })) }));
  const history: Array<{ tenantId: string; leadId: string; fromStage: PipelineStageKey; toStage: PipelineStageKey }> = [];
  const documents: LeadDocument[] = [];

  function visible(lead: Lead, tenantId: string, allowedStages: PipelineStageKey[] | null, ownerUserId: string | null) {
    return lead.tenantId === tenantId && (allowedStages === null || allowedStages.includes(lead.stage)) && (ownerUserId === null || lead.sdrOwnerId === ownerUserId);
  }

  return {
    async listLeads(tenantId, allowedStages, ownerUserId, filters) {
      options.onList?.(tenantId, allowedStages, ownerUserId, filters);
      return leads.filter((lead) => visible(lead, tenantId, allowedStages, ownerUserId));
    },
    async getLead(tenantId, leadId, allowedStages, ownerUserId) {
      return leads.find((lead) => lead.id === leadId && visible(lead, tenantId, allowedStages, ownerUserId)) ?? null;
    },
    async listLeadHistory(tenantId, leadId, allowedStages, ownerUserId) {
      options.onGetHistory?.(tenantId, leadId, allowedStages, ownerUserId);
      const currentLead = leads.find((lead) => lead.id === leadId && lead.tenantId === tenantId);
      if (currentLead && !visible(currentLead, tenantId, allowedStages, ownerUserId)) throw new LeadsNotFoundError('Lead not found');
      const scopedEvents = auditHistory
        .filter((event) => event.id.startsWith(`${tenantId}:${leadId}:`) && (allowedStages === null || event.stage === null || allowedStages.includes(event.stage)))
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
      if (!currentLead && scopedEvents.length === 0) throw new LeadsNotFoundError('Lead not found');
      return scopedEvents.map((event): LeadHistoryEvent => ({ ...event, id: event.id.split(':').at(-1) ?? event.id, actor: event.actor ? { ...event.actor } : null, changes: event.changes.map((change) => ({ ...change })) }));
    },
    async createLead(context, input: CreateLeadInput) {
      options.onCreate?.(context, input);
      const lead = makeLead({
        id: 'created-created-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: context.tenantId,
        stage: input.stage,
        leadSource: input.leadSource ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        utmTerm: input.utmTerm ?? null,
        fbp: input.fbp ?? null,
        fbc: input.fbc ?? null,
        fbclid: input.fbclid ?? null,
        gclid: input.gclid ?? null,
        contact: { ...makeLead().contact, name: input.contact.name, email: input.contact.email ?? null, metadata: { ...(input.contact.metadata ?? {}) } },
      });
      leads.push(lead);
      history.push({ tenantId: context.tenantId, leadId: lead.id, fromStage: input.stage, toStage: input.stage });
      return lead;
    },
    async updateLead(context, leadId, allowedStages, ownerUserId, input: UpdateLeadInput) {
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      if (input.notes !== undefined) lead.notes = input.notes;
      return lead;
    },
    async changeStage(context, leadId, allowedStages, ownerUserId, targetStage) {
      options.onChangeStage?.(context, leadId, allowedStages, ownerUserId, targetStage);
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      const fromStage = lead.stage;
      lead.stage = targetStage;
      history.push({ tenantId: context.tenantId, leadId, fromStage, toStage: targetStage });
      return lead;
    },
    async setLeadTags(context, leadId, allowedStages, ownerUserId, input) {
      options.onSetTags?.(context, leadId, allowedStages, ownerUserId, input);
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      return { ...lead, tags: input.tags.map((tag, index) => ({ id: `tag-${index}`, name: tag, slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'), color: null })) } as Lead;
    },
    async bulkSetLeadTags(context, leadIds, allowedStages, ownerUserId, input) {
      options.onBulkSetTags?.(context, leadIds, allowedStages, ownerUserId, input);
      return leads
        .filter((lead) => leadIds.includes(lead.id) && visible(lead, context.tenantId, allowedStages, ownerUserId))
        .map((lead) => ({ ...lead, tags: input.tags.map((tag, index) => ({ id: `tag-${index}`, name: tag, slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'), color: null })) } as Lead));
    },
    async deleteLead(context, leadId, allowedStages, ownerUserId) {
      options.onDelete?.(context, leadId, allowedStages, ownerUserId);
      const index = leads.findIndex((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (index === -1) throw new LeadsNotFoundError('Lead not found');
      leads.splice(index, 1);
    },
    async bulkDeleteLeads(context, leadIds, allowedStages, ownerUserId) {
      options.onBulkDelete?.(context, leadIds, allowedStages, ownerUserId);
      const visibleIds = new Set(leads.filter((lead) => leadIds.includes(lead.id) && visible(lead, context.tenantId, allowedStages, ownerUserId)).map((lead) => lead.id));
      for (let index = leads.length - 1; index >= 0; index -= 1) {
        if (visibleIds.has(leads[index].id)) leads.splice(index, 1);
      }
      return { deleted: visibleIds.size };
    },
    async listLeadDocuments(tenantId, leadId, allowedStages, ownerUserId) {
      const lead = leads.find((item) => item.id === leadId && visible(item, tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      return documents.filter((document) => document.tenantId === tenantId && document.leadId === leadId);
    },
    async addLeadDocument(context, leadId, allowedStages, ownerUserId, input) {
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      const document: LeadDocument = {
        id: `doc-${documents.length + 1}`,
        tenantId: context.tenantId,
        leadId,
        fileName: input.fileName,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? input.fileData?.length ?? null,
        fileUrl: input.fileUrl ?? null,
        previewUrl: `/api/leads/${leadId}/documents/doc-${documents.length + 1}/preview`,
        downloadUrl: `/api/leads/${leadId}/documents/doc-${documents.length + 1}/download`,
        storageBackend: input.storageBackend ?? 'postgres',
        checksumSha256: null,
        isPublic: false,
        uploadedByUserId: context.actorUserId,
        uploadedByUserAgent: input.uploadedByUserAgent ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      documents.unshift(document);
      return document;
    },
    async getLeadDocumentContent(tenantId, leadId, documentId, allowedStages, ownerUserId) {
      const lead = leads.find((item) => item.id === leadId && visible(item, tenantId, allowedStages, ownerUserId));
      if (!lead) return null;
      const document = documents.find((item) => item.tenantId === tenantId && item.leadId === leadId && item.id === documentId);
      return document ? { ...document, content: Buffer.from('test') } : null;
    },
    async deleteLeadDocument(context, leadId, documentId, allowedStages, ownerUserId) {
      const lead = leads.find((item) => item.id === leadId && visible(item, context.tenantId, allowedStages, ownerUserId));
      if (!lead) throw new LeadsNotFoundError('Lead not found');
      const index = documents.findIndex((document) => document.tenantId === context.tenantId && document.leadId === leadId && document.id === documentId);
      if (index === -1) throw new LeadsNotFoundError('Document not found');
      documents.splice(index, 1);
    },
    async countStageHistory(tenantId, leadId) {
      return history.filter((row) => row.tenantId === tenantId && row.leadId === leadId).length;
    },
    async updateLeadOwner(tenantId, leadId, sdrOwnerId) {
      const lead = leads.find((item) => item.id === leadId && item.tenantId === tenantId);
      if (!lead) return null;
      lead.sdrOwnerId = sdrOwnerId;
      return { ...lead, contact: { ...lead.contact } };
    },
    async createAuditLog() {},
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

test('GET /api/leads scopes non-admin sellers to their own assigned leads', async (t) => {
  const sellerId = '11111111-1111-4111-8111-111111111111';
  const otherSellerId = '33333333-3333-4333-8333-333333333333';
  const actor = makeAuthUser({ id: sellerId, roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  let capturedOwnerUserId: string | null | undefined;
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead', sdrOwnerId: sellerId }),
      makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'novo_lead', sdrOwnerId: otherSellerId }),
      makeLead({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', stage: 'novo_lead', sdrOwnerId: null }),
    ], { onList: (_tenantId, _allowedStages, ownerUserId) => { capturedOwnerUserId = ownerUserId; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedOwnerUserId, sellerId);
  assert.deepEqual(response.json().leads.map((lead: Lead) => lead.id), ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
});

test('GET /api/leads does not scope admins by owner', async (t) => {
  let capturedOwnerUserId: string | null | undefined;
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sdrOwnerId: '11111111-1111-4111-8111-111111111111' }),
      makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sdrOwnerId: '33333333-3333-4333-8333-333333333333' }),
      makeLead({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', sdrOwnerId: null }),
    ], { onList: (_tenantId, _allowedStages, ownerUserId) => { capturedOwnerUserId = ownerUserId; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedOwnerUserId, null);
  assert.equal(response.json().leads.length, 3);
});

test('GET /api/leads/:id rejects sellers opening another seller lead by direct URL', async (t) => {
  const sellerId = '11111111-1111-4111-8111-111111111111';
  const otherSellerId = '33333333-3333-4333-8333-333333333333';
  const actor = makeAuthUser({ id: sellerId, roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead', sdrOwnerId: otherSellerId }),
    ]),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', headers: { cookie } });

  assert.equal(response.statusCode, 404);
});

test('GET /api/leads accepts internal tag filters and keeps stage scope', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  let capturedFilters: unknown;
  let capturedStages: PipelineStageKey[] | null | undefined;
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([makeLead({ stage: 'novo_lead' })], {
      onList: (_tenantId, allowedStages, _ownerUserId, filters) => {
        capturedStages = allowedStages;
        capturedFilters = filters;
      },
    }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads?tags=VIP,urgente&tagMode=all', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(capturedFilters, { tags: ['vip', 'urgente'], tagMode: 'all' });
});

test('PATCH /api/leads/:id/tags requires lead.edit and updates internal tags', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view', 'lead.edit'], allowedStages: ['novo_lead'] });
  let capturedTags: string[] = [];
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead' })], {
      onSetTags: (_context, _leadId, allowedStages, _ownerUserId, input) => {
        assert.deepEqual(allowedStages, ['novo_lead']);
        capturedTags = input.tags;
      },
    }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tags',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { tags: ['VIP', 'Urgente', 'VIP'] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedTags, ['vip', 'urgente']);
  assert.deepEqual(response.json().lead.tags.map((tag: { slug: string }) => tag.slug), ['vip', 'urgente']);
});

test('DELETE /api/leads/:id requires lead.edit and deletes one visible lead', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view', 'lead.edit'], allowedStages: ['novo_lead'] });
  let capturedLeadId = '';
  let capturedStages: PipelineStageKey[] | null | undefined;
  const repository = makeLeadsRepository([
    makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead' }),
    makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'novo_lead' }),
  ], {
    onDelete: (_context, leadId, allowedStages) => {
      capturedLeadId = leadId;
      capturedStages = allowedStages;
    },
  });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: repository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'DELETE', url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', headers: { cookie } });
  const list = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { deleted: 1 });
  assert.equal(capturedLeadId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(list.json().leads.map((lead: Lead) => lead.id), ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
});

test('POST /api/leads/bulk/delete deletes only selected leads visible in current stage scope', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view', 'lead.edit'], allowedStages: ['novo_lead'] });
  let capturedIds: string[] = [];
  let capturedStages: PipelineStageKey[] | null | undefined;
  const repository = makeLeadsRepository([
    makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead' }),
    makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'novo_lead' }),
    makeLead({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', stage: 'diagnostico' }),
  ], {
    onBulkDelete: (_context, leadIds, allowedStages) => {
      capturedIds = leadIds;
      capturedStages = allowedStages;
    },
  });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: repository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/leads/bulk/delete',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { leadIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'] },
  });
  const list = await app.inject({ method: 'GET', url: '/api/leads', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { deleted: 1 });
  assert.deepEqual(capturedIds, ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']);
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(list.json().leads.map((lead: Lead) => lead.id), ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
});

test('POST /api/leads/bulk/tags applies normalized internal tags to selected visible leads', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view', 'lead.edit'], allowedStages: ['novo_lead'] });
  let capturedIds: string[] = [];
  let capturedTags: string[] = [];
  let capturedStages: PipelineStageKey[] | null | undefined;
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([
      makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'novo_lead' }),
      makeLead({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage: 'novo_lead' }),
      makeLead({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', stage: 'diagnostico' }),
    ], {
      onBulkSetTags: (_context, leadIds, allowedStages, _ownerUserId, input) => {
        capturedIds = leadIds;
        capturedStages = allowedStages;
        capturedTags = input.tags;
      },
    }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/leads/bulk/tags',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { leadIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'], tags: ['VIP', 'Follow up', 'VIP'] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedIds, ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']);
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(capturedTags, ['vip', 'follow-up']);
  assert.deepEqual(response.json().leads.map((lead: Lead) => lead.id), ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
  assert.deepEqual(response.json().leads[0].tags.map((tag: { slug: string }) => tag.slug), ['vip', 'follow-up']);
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

test('GET /api/leads/:id/history requires lead.view and returns safe newest-first audit events', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  let capturedStages: PipelineStageKey[] | null | undefined;
  const leadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository(
      [makeLead({ id: leadId, stage: 'novo_lead' })],
      { onGetHistory: (_tenantId, _leadId, allowedStages) => { capturedStages = allowedStages; } },
      [
        {
          id: `${TENANT_ID}:${leadId}:older`,
          action: 'lead.created',
          occurredAt: '2026-05-29T10:00:00.000Z',
          summary: 'Lead criado',
          actor: null,
          stage: 'novo_lead',
          changes: [{ field: 'stage', label: 'Etapa', before: null, after: 'novo_lead' }],
        },
        {
          id: `${TENANT_ID}:${leadId}:newer`,
          action: 'lead.updated',
          occurredAt: '2026-05-29T11:00:00.000Z',
          summary: 'Lead atualizado',
          actor: { id: actor.id, name: actor.name, email: actor.email },
          stage: 'novo_lead',
          changes: [
            { field: 'priority', label: 'Prioridade', before: 'media', after: 'alta' },
            { field: 'notes', label: 'Observações', before: null, after: 'Retornar amanhã' },
          ],
        },
      ],
    ),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: `/api/leads/${leadId}/history`, headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedStages, ['novo_lead']);
  assert.deepEqual(response.json(), {
    history: [
      {
        id: 'newer',
        action: 'lead.updated',
        occurredAt: '2026-05-29T11:00:00.000Z',
        summary: 'Lead atualizado',
        actor: { id: actor.id, name: actor.name, email: actor.email },
        stage: 'novo_lead',
        changes: [
          { field: 'priority', label: 'Prioridade', before: 'media', after: 'alta' },
          { field: 'notes', label: 'Observações', before: null, after: 'Retornar amanhã' },
        ],
      },
      {
        id: 'older',
        action: 'lead.created',
        occurredAt: '2026-05-29T10:00:00.000Z',
        summary: 'Lead criado',
        actor: null,
        stage: 'novo_lead',
        changes: [{ field: 'stage', label: 'Etapa', before: null, after: 'novo_lead' }],
      },
    ],
  });
  const serialized = JSON.stringify(response.json()).toLowerCase();
  assert.equal(serialized.includes('before_data'), false);
  assert.equal(serialized.includes('after_data'), false);
  assert.equal(serialized.includes('useragent'), false);
  assert.equal(serialized.includes('ip'), false);
});

test('GET /api/leads/:id/history hides deleted lead history outside allowed audit stage scope', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  const leadId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const app = createApp({
    userRepository: makeUserRepository(actor),
    leadsRepository: makeLeadsRepository([], {}, [
      {
        id: `${TENANT_ID}:${leadId}:deleted`,
        action: 'lead.deleted',
        occurredAt: '2026-05-29T12:00:00.000Z',
        summary: 'Lead excluído',
        actor: { id: actor.id, name: actor.name, email: actor.email },
        stage: 'diagnostico',
        changes: [{ field: 'stage', label: 'Etapa', before: 'diagnostico', after: null }],
      },
    ]),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: `/api/leads/${leadId}/history`, headers: { cookie } });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'Lead not found' });
});

test('GET /api/leads/:id/history rejects authenticated users without lead.view', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: [], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/history', headers: { cookie } });

  assert.equal(response.statusCode, 403);
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





test('POST /api/leads preserves attribution identifiers needed for Meta and Google matching', async (t) => {
  let captured: CreateLeadInput | null = null;
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    leadsRepository: makeLeadsRepository([], { onCreate: (_context, input) => { captured = input; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const payload = {
    contact: { name: 'Lead Atribuido', email: 'lead@example.com' },
    leadSource: 'site',
    utmSource: 'meta',
    utmMedium: 'paid_social',
    utmCampaign: 'campanha-maio',
    utmContent: 'criativo-a',
    utmTerm: 'energia-solar',
    fbp: 'fb.1.1710000000000.123456789',
    fbc: 'fb.1.1710000000000.AbCdEf',
    fbclid: 'AbCdEf',
    gclid: 'test-gclid',
  };
  const response = await app.inject({ method: 'POST', url: '/api/leads', headers: { cookie, 'content-type': 'application/json' }, payload });

  assert.equal(response.statusCode, 201);
  assert.ok(captured);
  const capturedInput = captured as CreateLeadInput;
  assert.equal(capturedInput.utmContent, payload.utmContent);
  assert.equal(capturedInput.utmTerm, payload.utmTerm);
  assert.equal(capturedInput.fbp, payload.fbp);
  assert.equal(capturedInput.fbc, payload.fbc);
  assert.equal(capturedInput.fbclid, payload.fbclid);
  assert.equal(capturedInput.gclid, payload.gclid);
  assert.equal(response.json().lead.fbp, payload.fbp);
  assert.equal(response.json().lead.fbc, payload.fbc);
});

test('POST /api/leads normalizes valid CPF and CNPJ into contact metadata', async (t) => {
  let captured: CreateLeadInput | null = null;
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    leadsRepository: makeLeadsRepository([], { onCreate: (_context, input) => { captured = input; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/leads',
    headers: { cookie, 'content-type': 'application/json' },
    payload: {
      contact: {
        name: 'Lead Documento',
        email: 'documento@example.com',
        cpf: '529.982.247-25',
        cnpj: '04.252.011/0001-10',
      },
    },
  });

  assert.equal(response.statusCode, 201);
  const capturedInput = captured as CreateLeadInput | null;
  assert.ok(capturedInput);
  assert.equal(capturedInput.contact.metadata?.cpf, '52998224725');
  assert.equal(capturedInput.contact.metadata?.cpfFormatted, '529.982.247-25');
  assert.equal(capturedInput.contact.metadata?.cnpj, '04252011000110');
  assert.equal(capturedInput.contact.metadata?.cnpjFormatted, '04.252.011/0001-10');
});

test('POST /api/leads rejects invalid CPF and CNPJ', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), leadsRepository: makeLeadsRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const invalidCpf = await app.inject({
    method: 'POST',
    url: '/api/leads',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { contact: { name: 'Lead CPF', cpf: '111.111.111-11' } },
  });
  assert.equal(invalidCpf.statusCode, 400);
  assert.match(invalidCpf.json().error, /contact\.cpf.*valid/);

  const invalidCnpj = await app.inject({
    method: 'POST',
    url: '/api/leads',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { contact: { name: 'Lead CNPJ', cnpj: '11.111.111/1111-11' } },
  });
  assert.equal(invalidCnpj.statusCode, 400);
  assert.match(invalidCnpj.json().error, /contact\.cnpj.*valid/);
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

test('Meta stage-change payload includes lead qualification data for Kanban moves', () => {
  const lead = makeLead({
    stage: 'diagnostico',
    qualificationStatus: 'qualificado',
    priority: 'alta',
    estimatedTicket: '35000.00',
    metadata: {
      energyBillValue: 820,
      averageConsumptionKwh: 640,
      concessionaria: 'Copel',
      offer: 'Solar por assinatura',
      projectedSavings: 246,
      qualificationScore: 87,
      qualificationReason: 'Conta alta e perfil elegível',
    },
    contact: {
      ...makeLead().contact,
      metadata: { cidade: 'Curitiba', estado: 'PR' },
    },
  });

  const payload = buildMetaStageEventPayloadForTest(
    lead,
    { tenantId: TENANT_ID, actorUserId: '11111111-1111-4111-8111-111111111111' },
    'stage_changed',
    'conta_recebida',
  );

  assert.equal(payload.qualificationStatus, 'qualificado');
  assert.deepEqual(payload.qualification, {
    status: 'qualificado',
    priority: 'alta',
    estimatedTicket: 35000,
    energyBillValue: 820,
    averageConsumptionKwh: 640,
    concessionaria: 'Copel',
    offer: 'Solar por assinatura',
    projectedSavings: 246,
    score: 87,
    reason: 'Conta alta e perfil elegível',
  });
  assert.equal(payload.transitionDirection, 'forward');
});

test('manual Kanban stage-change CAPI events wait 10 minutes and supersede pending moves', async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  const lead = makeLead({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stage: 'diagnostico' });

  await queueMetaStageEventForTest(
    client as never,
    { tenantId: TENANT_ID, actorUserId: '11111111-1111-4111-8111-111111111111' },
    lead,
    'stage_changed',
    'conta_recebida',
  );

  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /status = 'discarded'::delivery_status/);
  assert.match(queries[0].sql, /next_retry_at > now\(\)/);
  assert.equal(queries[0].params[0], TENANT_ID);
  assert.equal(queries[0].params[1], lead.id);
  assert.match(queries[1].sql, /now\(\) \+ interval '10 minutes'/);
  assert.equal(queries[1].params[2], 'EnervitaQualifiedLead');
  const payload = JSON.parse(String(queries[1].params[3]));
  assert.equal(payload.action, 'stage_changed');
  assert.equal(payload.stage, 'diagnostico');
  assert.equal(payload.fromStage, 'conta_recebida');
});
