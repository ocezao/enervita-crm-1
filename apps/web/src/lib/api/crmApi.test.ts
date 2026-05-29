
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
});
