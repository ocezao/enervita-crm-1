import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const leadId = '11111111-1111-4111-8111-111111111111';
const operator = {
  id: 'user-detail',
  name: 'SDR Detalhe',
  email: 'detail@example.com',
  roles: [],
  permissions: ['lead.view'],
  allowedStages: ['novo_lead', 'qualificacao'],
};
const lead = {
  id: leadId,
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
    name: 'Lead com Histórico',
    email: 'lead@example.com',
    phone: '45999999999',
    company: 'Empresa Histórico',
    source: 'site',
    consent: true,
    createdAt: '2026-05-29T00:00:00.000Z',
  },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockLeadDetailFetch(history: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/me') return jsonResponse({ user: operator });
    if (url === `/api/leads/${leadId}`) return jsonResponse({ lead });
    if (url === `/api/leads/${leadId}/activities`) return jsonResponse({ activities: [] });
    if (url === `/api/leads/${leadId}/tasks`) return jsonResponse({ tasks: [] });
    if (url === `/api/leads/${leadId}/history`) return jsonResponse({ history });
    return jsonResponse({ error: 'Not found' }, 404);
  });
}

describe('Lead detail history tab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', `/leads/${leadId}`);
  });

  it('renders history entries with actor, action, date, summary and field changes', async () => {
    const fetchMock = mockLeadDetailFetch([
      {
        id: 'hist-1',
        action: 'lead.updated',
        occurredAt: '2026-05-29T14:30:00.000Z',
        actor: { id: 'user-1', name: 'Ana Operadora', email: 'ana@example.com' },
        summary: 'Lead atualizado manualmente',
        changes: [
          { field: 'stage', label: 'Etapa', before: 'Novo lead', after: 'Qualificação' },
          { field: 'priority', label: 'Prioridade', before: 'Média', after: 'Alta' },
        ],
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(await screen.findByText('Lead com Histórico')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /histórico/i }));

    const historyPanel = screen.getByRole('region', { name: /histórico do lead/i });
    expect(within(historyPanel).getByText('Lead atualizado manualmente')).toBeInTheDocument();
    expect(within(historyPanel).getByText(/lead.updated/i)).toBeInTheDocument();
    expect(within(historyPanel).getByText(/Ana Operadora/)).toBeInTheDocument();
    expect(within(historyPanel).getByText(/ana@example.com/)).toBeInTheDocument();
    expect(within(historyPanel).getByText(/29\/05\/2026/)).toBeInTheDocument();
    expect(within(historyPanel).getByText('Etapa')).toBeInTheDocument();
    expect(within(historyPanel).getByText(/Novo lead/)).toBeInTheDocument();
    expect(within(historyPanel).getByText(/Qualificação/)).toBeInTheDocument();
    expect(within(historyPanel).getByText('Prioridade')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/leads/${leadId}/history`, { credentials: 'include' });
  });

  it('renders system-generated history entries without an actor instead of breaking lead opening', async () => {
    vi.stubGlobal('fetch', mockLeadDetailFetch([
      {
        id: 'hist-system-1',
        action: 'lead.assigned',
        occurredAt: '2026-06-06T18:55:00.000Z',
        actor: null,
        summary: 'Lead atribuído automaticamente',
        changes: [],
      },
    ]));

    render(<App />);
    expect(await screen.findByText('Lead com Histórico')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /histórico/i }));

    const historyPanel = screen.getByRole('region', { name: /histórico do lead/i });
    expect(within(historyPanel).getByText('Lead atribuído automaticamente')).toBeInTheDocument();
    expect(within(historyPanel).getByText(/Sistema/)).toBeInTheDocument();
  });

  it('shows an empty state when no history is returned', async () => {
    vi.stubGlobal('fetch', mockLeadDetailFetch([]));

    render(<App />);
    expect(await screen.findByText('Lead com Histórico')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /histórico/i }));

    expect(screen.getByText('Nenhum histórico registrado')).toBeInTheDocument();
    expect(screen.getByText('As alterações deste lead aparecerão aqui quando forem registradas.')).toBeInTheDocument();
  });
});
