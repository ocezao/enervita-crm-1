
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './crmApi';

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

    expect(fetchMock).toHaveBeenCalledWith('/api/leads', { credentials: 'include' });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: 'lead-1',
      stage: 'novo_lead',
      qualificationStatus: 'qualificado',
      estimatedTicket: 1234.56,
      energyBillValue: 0,
      projectedSavings: 0,
      contact: { name: 'Maria Solar', company: 'Padaria Sol' },
    });
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

    expect(fetchMock).toHaveBeenCalledWith('/api/leads/lead-1/stage', {
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

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/tasks', { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tasks/task-1/complete', { credentials: 'include', method: 'PATCH' });
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

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/leads/lead-1/activities', { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/leads/lead-1/activities', {
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

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard', { credentials: 'include' });
    expect(metrics.newLeadsToday).toBe(5);
    expect(metrics.recentEvents[0].outcome).toBe('Atividade real');
  });


});
