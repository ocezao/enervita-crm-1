import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const operator = {
  id: 'user-integrations',
  name: 'Admin Integrações',
  email: 'integracoes@example.com',
  roles: [],
  permissions: ['page.automations', 'page.webhooks', 'webhook.test', 'automation.manage'],
  allowedStages: [],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Operational integrations pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads automations from the real API catalog and shows planned status', async () => {
    window.history.pushState({}, '', '/automations');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });
      if (url === '/api/automations') return jsonResponse({ automations: [{ id: 'lead-no-followup-12h', name: 'Alerta sem follow-up', trigger: 'lead.no_followup_12h', conditions: ['Sem atividade há 12h'], actions: ['Criar tarefa urgente'], active: false, status: 'planned' }] });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Alerta sem follow-up')).toBeInTheDocument();
    expect(screen.getAllByText(/Planejada/i).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/automations', { credentials: 'include' });
  });

  it('records controlled webhook test deliveries through the API and shows dispatcher status details', async () => {
    window.history.pushState({}, '', '/webhooks');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });
      if (url === '/api/webhooks') return jsonResponse({ webhooks: [{ id: 'n8n-lead-created', name: 'n8n - lead criado', url: 'https://n8n.enervita.com.br/webhook/lead-created', eventTypes: ['lead.created'], status: 'planned', successRate: 0, secretConfigured: false }] });
      if (url === '/api/webhooks/deliveries') return jsonResponse({ deliveries: [{ id: 'delivery-sent', webhookId: 'n8n-lead-created', webhookName: 'n8n - lead criado', eventType: 'lead.created', status: 'sent', httpStatus: 200, attempts: 1, createdAt: '2026-05-29T09:00:00.000Z', deliveredAt: '2026-05-29T09:00:02.000Z', responseBody: 'ok' }] });
      if (url === '/api/webhooks/n8n-lead-created/test' && init?.method === 'POST') return jsonResponse({ result: { success: true, message: 'Entrega de teste registrada na fila controlada', delivery: { id: 'delivery-1', webhookId: 'n8n-lead-created', webhookName: 'n8n - lead criado', eventType: 'webhook.test', status: 'queued', httpStatus: null, attempts: 0, createdAt: '2026-05-29T10:00:00.000Z' } } });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('n8n - lead criado')).toBeInTheDocument();
    expect(await screen.findByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText(/HTTP 200/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /testar webhook n8n - lead criado/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/webhooks/n8n-lead-created/test', { credentials: 'include', method: 'POST' });
    });
    expect(await screen.findByText('Entrega de teste registrada na fila controlada')).toBeInTheDocument();
    expect(await screen.findByText(/webhook.test/)).toBeInTheDocument();
    expect(screen.getByText('Na fila')).toBeInTheDocument();
  });
});
