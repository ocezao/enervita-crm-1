
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectFetchCalled } from '../../test/testHelpers';
import { api, formatCnpj, formatCpf, isValidCnpj, isValidCpf } from './crmApi';

describe('crmApi HTTP client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists leads from /api/leads using session cookies and maps backend fields for the UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        leads: [
          {
            id: 'lead-1',
            tenantId: 'tenant-1',
            contactId: 'contact-1',
            stage: 'novo_lead',
            qualificationStatus: 'qualificado',
            leadSource: 'site',
            estimatedTicket: '1234.56',
            priority: 'alta',
            notes: 'Lead real',
            createdAt: '2026-05-29T00:00:00.000Z',
            updatedAt: '2026-05-29T01:00:00.000Z',
            tags: [{ id: 'tag-1', name: 'VIP', slug: 'vip', color: null }],
            tags: [{ id: 'tag-1', name: 'VIP', slug: 'vip', color: null }],
            contact: {
              id: 'contact-1',
              name: 'Maria Solar',
              email: 'maria@example.com',
              phone: '45999990000',
              company: 'Padaria Sol',
              source: 'site',
              consent: true,
              createdAt: '2026-05-29T00:00:00.000Z',
              updatedAt: '2026-05-29T00:00:00.000Z',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const leads = await api.listLeads();

    expectFetchCalled(fetchMock, '/api/leads', { credentials: 'include' });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: 'lead-1',
      stage: 'novo_lead',
      qualificationStatus: 'qualificado',
      estimatedTicket: 1234.56,
      energyBillValue: 0,
      projectedSavings: 0,
      contact: { name: 'Maria Solar', company: 'Padaria Sol' },
      tags: [{ id: 'tag-1', name: 'VIP', slug: 'vip', color: null }],
    });
  });

  it('serializes lead tag filters and updates internal tags', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ leads: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lead: { id: 'lead-1', contactId: 'contact-1', stage: 'novo_lead', qualificationStatus: null, leadSource: 'site', estimatedTicket: null, priority: 'media', tags: [{ id: 'tag-1', name: 'vip', slug: 'vip', color: null }], createdAt: '2026-05-29T00:00:00.000Z', updatedAt: '2026-05-29T01:00:00.000Z', contact: { id: 'contact-1', name: 'Maria Solar', email: null, phone: null, company: null, source: null, consent: true, createdAt: '2026-05-29T00:00:00.000Z' } } }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.listLeads({ tags: ['vip', 'urgente'], tagMode: 'all' });
    const updated = await api.setLeadTags('lead-1', ['vip']);

    expectFetchCalled(fetchMock, '/api/leads?tags=vip%2Curgente&tagMode=all', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/leads/lead-1/tags', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['vip'] }),
    });
    expect(updated.tags.map((tag) => tag.slug)).toEqual(['vip']);
  });

  it('serializes lead tag filters and updates internal tags', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ leads: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lead: { id: 'lead-1', contactId: 'contact-1', stage: 'novo_lead', qualificationStatus: null, leadSource: 'site', estimatedTicket: null, priority: 'media', tags: [{ id: 'tag-1', name: 'vip', slug: 'vip', color: null }], createdAt: '2026-05-29T00:00:00.000Z', updatedAt: '2026-05-29T01:00:00.000Z', contact: { id: 'contact-1', name: 'Maria Solar', email: null, phone: null, company: null, source: null, consent: true, createdAt: '2026-05-29T00:00:00.000Z' } } }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.listLeads({ tags: ['vip', 'urgente'], tagMode: 'all' });
    const updated = await api.setLeadTags('lead-1', ['vip']);

    expectFetchCalled(fetchMock, '/api/leads?tags=vip%2Curgente&tagMode=all', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/leads/lead-1/tags', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['vip'] }),
    });
    expect(updated.tags.map((tag) => tag.slug)).toEqual(['vip']);
  });

  it('updates lead stage through the backend endpoint using session cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lead: {
          id: 'lead-1',
          contactId: 'contact-1',
          stage: 'qualificacao',
          qualificationStatus: null,
          leadSource: 'site',
          estimatedTicket: null,
          priority: 'media',
          createdAt: '2026-05-29T00:00:00.000Z',
          updatedAt: '2026-05-29T01:00:00.000Z',
          contact: { id: 'contact-1', name: 'Maria Solar', email: null, phone: null, company: null, source: null, consent: true, createdAt: '2026-05-29T00:00:00.000Z' },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await api.updateLeadStage('lead-1', 'qualificacao');

    expectFetchCalled(fetchMock, '/api/leads/lead-1/stage', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'qualificacao' }),
    });
    expect(updated.stage).toBe('qualificacao');
  });

  it('returns undefined when a lead detail endpoint responds 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Lead not found' }) }));

    await expect(api.getLead('missing')).resolves.toBeUndefined();
  });

  it('lists lead history and maps backend history fields for the UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        history: [
          {
            id: 'history-1',
            action: 'lead.updated',
            occurredAt: '2026-05-29T14:30:00.000Z',
            actor: { id: 'user-1', name: 'Ana Operadora', email: 'ana@example.com' },
            summary: 'Lead atualizado manualmente',
            changes: [
              { field: 'stage', label: 'Etapa', before: 'novo_lead', after: 'qualificacao' },
              { field: 'notes', label: 'Observações', before: null, after: 'Conta recebida' },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const history = await api.listLeadHistory('lead-1');

    expectFetchCalled(fetchMock, '/api/leads/lead-1/history', { credentials: 'include' });
    expect(history).toEqual([
      {
        id: 'history-1',
        action: 'lead.updated',
        occurredAt: '2026-05-29T14:30:00.000Z',
        actor: { id: 'user-1', name: 'Ana Operadora', email: 'ana@example.com' },
        summary: 'Lead atualizado manualmente',
        changes: [
          { field: 'stage', label: 'Etapa', before: 'novo_lead', after: 'qualificacao' },
          { field: 'notes', label: 'Observações', before: null, after: 'Conta recebida' },
        ],
      },
    ]);
  });

  it('lists and completes tasks through real task endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [{ id: 'task-1', leadId: 'lead-1', title: 'Ligar', status: 'pendente', priority: 'alta', ownerName: 'SDR', dueDate: '2026-05-30T12:00:00.000Z', createdAt: '2026-05-29T00:00:00.000Z', updatedAt: '2026-05-29T00:00:00.000Z', leadName: 'Maria Solar' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task: { id: 'task-1', leadId: 'lead-1', title: 'Ligar', status: 'concluido', priority: 'alta', ownerName: 'SDR', dueDate: '2026-05-30T12:00:00.000Z', createdAt: '2026-05-29T00:00:00.000Z', updatedAt: '2026-05-29T01:00:00.000Z', leadName: 'Maria Solar' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const tasks = await api.listTasks();
    const completed = await api.completeTask('task-1');

    expectFetchCalled(fetchMock, '/api/tasks', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/tasks/task-1/complete', { credentials: 'include', method: 'PATCH' });
    expect(tasks[0]).toMatchObject({ id: 'task-1', title: 'Ligar', leadName: 'Maria Solar' });
    expect(completed.status).toBe('concluido');
  });

  it('lists and creates lead activities through real timeline endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activities: [{ id: 'activity-1', leadId: 'lead-1', contactId: 'contact-1', activityType: 'note', outcome: 'Nota real', occurredAt: '2026-05-29T00:00:00.000Z', createdAt: '2026-05-29T00:00:00.000Z' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activity: { id: 'activity-2', leadId: 'lead-1', contactId: 'contact-1', activityType: 'whatsapp', outcome: 'Resposta WhatsApp', occurredAt: '2026-05-29T01:00:00.000Z', createdAt: '2026-05-29T01:00:00.000Z' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const activities = await api.listActivities('lead-1');
    const created = await api.createActivity({ leadId: 'lead-1', activityType: 'whatsapp', outcome: 'Resposta WhatsApp' });

    expectFetchCalled(fetchMock, '/api/leads/lead-1/activities', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/leads/lead-1/activities', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityType: 'whatsapp', outcome: 'Resposta WhatsApp', notes: undefined }),
    });
    expect(activities[0].outcome).toBe('Nota real');
    expect(created.activityType).toBe('whatsapp');
  });


  it('loads dashboard metrics from /api/dashboard using session cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metrics: {
          newLeadsToday: 5,
          leadsWithoutFollowup: 2,
          overdueTasks: 1,
          openProposals: 4,
          leadsBySource: [{ source: 'site', count: 5 }],
          leadsByStage: [{ stage: 'novo_lead', count: 3 }],
          conversionsByPlatform: [{ platform: 'meta', count: 2 }],
          recentEvents: [{ id: 'activity-1', leadId: 'lead-1', contactId: 'contact-1', activityType: 'note', outcome: 'Atividade real', occurredAt: '2026-05-29T00:00:00.000Z', createdAt: '2026-05-29T00:00:00.000Z' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await api.listDashboardMetrics();

    expectFetchCalled(fetchMock, '/api/dashboard', { credentials: 'include' });
    expect(metrics.newLeadsToday).toBe(5);
    expect(metrics.recentEvents[0].outcome).toBe('Atividade real');
  });


  it('lists automations and webhooks through real integration endpoints and dry-runs webhook tests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ automations: [{ id: 'lead-no-followup-12h', name: 'Alerta sem follow-up', trigger: 'lead.no_followup_12h', conditions: ['Sem atividade há 12h'], actions: ['Criar tarefa urgente'], active: false, status: 'planned' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhooks: [{ id: 'n8n-lead-created', name: 'n8n lead.created', url: 'https://n8n.enervita.com.br/webhook/lead-created', eventTypes: ['lead.created'], status: 'planned', successRate: 0, secretConfigured: false }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { success: true, message: 'Webhook dry-run validado' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const automations = await api.listAutomations();
    const webhooks = await api.listWebhooks();
    const result = await api.testWebhook('n8n-lead-created');

    expectFetchCalled(fetchMock, '/api/automations', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/webhooks', { credentials: 'include' });
    expectFetchCalled(fetchMock, '/api/webhooks/n8n-lead-created/test', { credentials: 'include', method: 'POST' });
    expect(automations[0]).toMatchObject({ id: 'lead-no-followup-12h', trigger: 'lead.no_followup_12h' });
    expect(webhooks[0]).toMatchObject({ id: 'n8n-lead-created', status: 'planned' });
    expect(result.success).toBe(true);
  });

  it('formats, validates and sends CPF/CNPJ when creating a lead', async () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCnpj('04252011000110')).toBe('04.252.011/0001-10');
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCnpj('04.252.011/0001-10')).toBe(true);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lead: {
          id: 'lead-docs',
          contactId: 'contact-docs',
          stage: 'novo_lead',
          qualificationStatus: 'aguardando',
          leadSource: 'crm_manual',
          estimatedTicket: null,
          priority: 'media',
          tags: [],
          createdAt: '2026-05-29T00:00:00.000Z',
          updatedAt: '2026-05-29T00:00:00.000Z',
          contact: {
            id: 'contact-docs',
            name: 'Lead Documento',
            email: 'docs@example.com',
            phone: '45999999999',
            company: 'Empresa Documento',
            source: 'crm_manual',
            consent: true,
            createdAt: '2026-05-29T00:00:00.000Z',
            metadata: {
              cpf: '52998224725',
              cpfFormatted: '529.982.247-25',
              cnpj: '04252011000110',
              cnpjFormatted: '04.252.011/0001-10',
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.createLead({
      name: 'Lead Documento',
      email: 'docs@example.com',
      phone: '45999999999',
      company: 'Empresa Documento',
      leadSource: 'crm_manual',
      cpf: '529.982.247-25',
      cnpj: '04.252.011/0001-10',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.contact.cpf).toBe('529.982.247-25');
    expect(body.contact.cnpj).toBe('04.252.011/0001-10');
    expect(body.contact.metadata.cpf).toBe('52998224725');
    expect(body.contact.metadata.cnpj).toBe('04252011000110');
  });


});
