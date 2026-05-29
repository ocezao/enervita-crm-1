import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const operator = {
  id: 'user-integrations',
  name: 'Admin Integrações',
  email: 'integracoes@example.com',
  roles: [],
  permissions: ['page.automations', 'page.webhooks', 'webhook.test'],
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

  it('dry-runs webhook tests through the API and shows the result to the operator', async () => {
    window.history.pushState({}, '', '/webhooks');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });
      if (url === '/api/webhooks') return jsonResponse({ webhooks: [{ id: 'n8n-lead-created', name: 'n8n - lead criado', url: 'https://n8n.enervita.com.br/webhook/lead-created', eventTypes: ['lead.created'], status: 'planned', successRate: 0, secretConfigured: false }] });
      if (url === '/api/webhooks/n8n-lead-created/test' && init?.method === 'POST') return jsonResponse({ result: { success: true, message: 'Webhook dry-run validado' } });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('n8n - lead criado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /testar webhook n8n - lead criado/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/webhooks/n8n-lead-created/test', { credentials: 'include', method: 'POST' });
    });
    expect(await screen.findByText('Webhook dry-run validado')).toBeInTheDocument();
  });
});
