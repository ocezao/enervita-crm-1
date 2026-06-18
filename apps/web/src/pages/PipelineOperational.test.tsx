import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { waitForFetchCalled } from '../test/testHelpers';

const operator = {
  id: 'user-pipeline',
  name: 'SDR Pipeline',
  email: 'sdr@example.com',
  roles: [],
  permissions: ['page.pipeline', 'lead.view', 'lead.stage_change'],
  allowedStages: ['novo_lead', 'qualificacao'],
};

function lead(overrides: Record<string, unknown> = {}) {
  const id = String(overrides.id ?? '11111111-1111-4111-8111-111111111111');
  return {
    id,
    contactId: '22222222-2222-4222-8222-222222222222',
    stage: 'novo_lead',
    qualificationStatus: 'qualificado',
    leadSource: 'site',
    estimatedTicket: '1200',
    priority: 'alta',
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T01:00:00.000Z',
    contact: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Lead Pipeline Real',
      email: 'lead@example.com',
      phone: '45999999999',
      company: 'Empresa Pipeline',
      source: 'site',
      consent: true,
      createdAt: '2026-05-29T00:00:00.000Z',
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Pipeline operacional', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/pipeline');
  });

  it('shows only allowed stages and moves a lead to the next allowed stage through the API', async () => {
    let currentStage = 'novo_lead';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
      if (url === '/api/leads' && !init?.method) return jsonResponse({ leads: [lead({ stage: currentStage })] });
      if (url === '/api/leads/11111111-1111-4111-8111-111111111111/stage' && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body));
        currentStage = payload.stage;
        return jsonResponse({ lead: lead({ stage: currentStage }) });
      }
      return jsonResponse({ error: 'Not found' }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByText('Lead Pipeline Real')).toBeInTheDocument();
    expect(screen.getByText('Novo lead')).toBeInTheDocument();
    expect(screen.getByText('Qualificação')).toBeInTheDocument();
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /mover lead pipeline real para qualificação/i }));

    await waitForFetchCalled(fetchMock, '/api/leads/11111111-1111-4111-8111-111111111111/stage', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'qualificacao', notes: 'Movido pelo pipeline visual' }),
      });

    const column = screen.getByTestId('pipeline-column-qualificacao');
    expect(within(column).getByText('Lead Pipeline Real')).toBeInTheDocument();
  });

  it('orders leads by entry date and shows elapsed time and entry priority badges', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-17T12:00:00.000Z').getTime());

    const recentLead = lead({
      id: '11111111-1111-4111-8111-111111111112',
      createdAt: '2026-06-16T00:00:00.000Z',
      metadata: { meta: { createdTime: '2026-06-17T03:00:00.000Z' } },
      updatedAt: '2026-06-17T03:10:00.000Z',
      contact: { ...lead().contact, name: 'Lead Novo' },
    });
    const waitingLead = lead({
      id: '11111111-1111-4111-8111-111111111113',
      createdAt: '2026-06-15T06:00:00.000Z',
      updatedAt: '2026-06-15T07:00:00.000Z',
      contact: { ...lead().contact, name: 'Lead Sem Contato' },
    });
    const stalledLead = lead({
      id: '11111111-1111-4111-8111-111111111114',
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T01:00:00.000Z',
      contact: { ...lead().contact, name: 'Lead Parado' },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
      if (url === '/api/leads') return jsonResponse({ leads: [stalledLead, waitingLead, recentLead] });
      return jsonResponse({ error: 'Not found' }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByText('Lead Novo')).toBeInTheDocument();
    const column = await screen.findByTestId('pipeline-column-novo_lead');
    const cardNames = within(column).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);

    expect(cardNames).toEqual(['Lead Novo', 'Lead Sem Contato', 'Lead Parado']);
    expect(within(column).getByText('Novo')).toBeInTheDocument();
    expect(within(column).getByText('Sem contato')).toBeInTheDocument();
    expect(within(column).getByText('Parado')).toBeInTheDocument();
    expect(column.textContent).toContain('Entrada');
    expect(column.textContent).toContain('há 9 horas');
    expect(column.textContent).toContain('há 2 dias e 6 horas');
    expect(column.textContent).toContain('há 4 dias e 12 horas');
  });
});
