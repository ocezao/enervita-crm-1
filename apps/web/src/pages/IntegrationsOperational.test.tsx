import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { waitForFetchCalled, expectFetchCalled } from '../test/testHelpers';

const operator = {
  id: 'user-integrations',
  name: 'Admin Integrações',
  email: 'integracoes@example.com',
  roles: [],
  permissions: ['page.automations', 'page.webhooks', 'webhook.test', 'automation.manage', 'page.settings', 'settings.manage'],
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
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
      if (url === '/api/automations') return jsonResponse({ automations: [{ id: 'lead-no-followup-12h', name: 'Alerta sem follow-up', trigger: 'lead.no_followup_12h', conditions: ['Sem atividade há 12h'], actions: ['Criar tarefa urgente'], active: false, status: 'planned' }] });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Alerta sem follow-up')).toBeInTheDocument();
    expect(screen.getAllByText(/Planejada/i).length).toBeGreaterThan(0);
    expectFetchCalled(fetchMock, '/api/automations', { credentials: 'include' });
  });

  it('records controlled webhook test deliveries through the API and shows dispatcher status details', async () => {
    window.history.pushState({}, '', '/webhooks');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
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

    await userEvent.click(screen.getByRole('button', { name: /validar integração n8n - lead criado/i }));

    await waitForFetchCalled(fetchMock, '/api/webhooks/n8n-lead-created/test', { credentials: 'include', method: 'POST' });
    expect(await screen.findByText('Entrega de teste registrada na fila controlada')).toBeInTheDocument();
    expect(await screen.findByText(/webhook.test/)).toBeInTheDocument();
    expect(screen.getByText('Na fila')).toBeInTheDocument();
  });

  it('centralizes internal automations, events, webhooks and production readiness in settings integrations', async () => {
    window.history.pushState({}, '', '/settings');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
      if (url === '/api/automations') return jsonResponse({ automations: [{ id: 'lead-no-followup-12h', name: 'Alerta de lead sem follow-up em 12h', trigger: 'lead.no_followup_12h', conditions: ['Lead sem atividade recente'], actions: ['Criar tarefa urgente'], active: true, status: 'active' }] });
      if (url === '/api/webhooks') return jsonResponse({ webhooks: [{ id: 'n8n-lead-created', name: 'n8n - lead criado', url: 'https://n8n.enervita.com.br/webhook/lead-created', eventTypes: ['lead.created', 'automation.run'], status: 'active', successRate: 98, secretConfigured: false }] });
      if (url === '/api/webhooks/deliveries') return jsonResponse({ deliveries: [{ id: 'delivery-queued', webhookId: 'n8n-lead-created', webhookName: 'n8n - lead criado', eventType: 'lead.created', status: 'queued', httpStatus: null, attempts: 0, createdAt: '2026-05-29T09:00:00.000Z' }] });
      if (url === '/api/automations/lead-no-followup-12h/run' && init?.method === 'POST') return jsonResponse({ run: { id: 'run-1', automationId: 'lead-no-followup-12h', status: 'success', inputPayload: {}, outputPayload: { queuedWebhookDeliveries: 1, externalHttpCalled: false }, startedAt: '2026-05-29T10:00:00.000Z', finishedAt: '2026-05-29T10:00:01.000Z' } });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /integrações/i }));

    expect(await screen.findByText('Automações internas')).toBeInTheDocument();
    expect(await screen.findByText('Alerta de lead sem follow-up em 12h')).toBeInTheDocument();
    expect(screen.getByText('Eventos monitorados')).toBeInTheDocument();
    expect(screen.getByText('Checklist de prontidão para produção')).toBeInTheDocument();
    expect(screen.getByText(/Segredo configurado:/)).toBeInTheDocument();
    expect(screen.getAllByText(/Gerador de chaves de acesso/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /validar automação alerta de lead sem follow-up/i }));

    await waitForFetchCalled(fetchMock, '/api/automations/lead-no-followup-12h/run', { method: 'POST' });
    expect(await screen.findByText(/1 entrega\(s\) enfileirada\(s\)/)).toBeInTheDocument();
  });


  it('explains the funnel stages, ownership and automation/webhook placement in settings pipeline', async () => {
    window.history.pushState({}, '', '/settings');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: operator });if(url.startsWith('/api/notifications'))return jsonResponse({notifications:[],unreadCount:0});if(url.startsWith('/api/follow-ups'))return jsonResponse({followUps:[]});if(url==='/api/automations/n8n-workflows')return jsonResponse({workflows:[]});
      if (url === '/api/leads') return jsonResponse({ leads: [
        { id: 'lead-1', contactId: 'contact-1', stage: 'novo_lead', qualificationStatus: 'novo', leadSource: 'Meta Ads', estimatedTicket: 0, sdrOwner: 'João', createdAt: '2026-05-29T09:00:00.000Z', updatedAt: '2026-05-29T09:00:00.000Z', energyBillValue: 600, averageConsumptionKwh: 500, concessionaria: 'Elektro', offer: 'Assinatura', projectedSavings: 120, priority: 'alta' },
        { id: 'lead-2', contactId: 'contact-2', stage: 'proposta_enviada', qualificationStatus: 'qualificado', leadSource: 'Google', estimatedTicket: 0, sdrOwner: 'Maria', createdAt: '2026-05-29T09:00:00.000Z', updatedAt: '2026-05-29T09:00:00.000Z', energyBillValue: 900, averageConsumptionKwh: 700, concessionaria: 'Energisa', offer: 'Instalação', projectedSavings: 180, priority: 'media' }
      ] });
      if (url === '/api/tasks') return jsonResponse({ tasks: [{ id: 'task-1', leadId: 'lead-1', title: 'Retornar lead', status: 'atrasado', priority: 'alta', owner: 'João', dueDate: '2026-05-29', createdAt: '2026-05-29T09:00:00.000Z', updatedAt: '2026-05-29T09:00:00.000Z' }] });
      if (url === '/api/automations') return jsonResponse({ automations: [{ id: 'lead-no-followup-12h', name: 'Alerta de lead sem follow-up em 12h', trigger: 'lead.no_followup_12h', conditions: ['Lead sem atividade recente'], actions: ['Criar tarefa urgente'], active: true, status: 'active' }] });
      if (url === '/api/webhooks') return jsonResponse({ webhooks: [{ id: 'n8n-lead-created', name: 'n8n - lead criado', url: 'https://n8n.enervita.com.br/webhook/lead-created', eventTypes: ['lead.created', 'lead.no_followup_12h'], status: 'active', successRate: 90, secretConfigured: false }] });
      if (url === '/api/webhooks/deliveries') return jsonResponse({ deliveries: [] });
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /etapas do funil/i }));

    expect(await screen.findByText('Funil comercial Enervita, ponta a ponta')).toBeInTheDocument();
    expect(screen.getByText('Linha visual do funil')).toBeInTheDocument();
    expect(screen.getAllByText('1. Entrada do lead').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6. Proposta enviada').length).toBeGreaterThan(0);
    expect(screen.getByText('Como a automação entra nesta etapa')).toBeInTheDocument();
    expect(screen.getByText('Automações por etapa')).toBeInTheDocument();
    expect(screen.getByText('Eventos e webhooks')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /6\. Proposta enviada/i }));
    expect(screen.getAllByText('Proposta com follow-up controlado até decisão.').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/proposal.open_48h/).length).toBeGreaterThan(0);
  });

});