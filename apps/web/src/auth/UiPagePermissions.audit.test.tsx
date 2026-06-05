import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Component = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  return {
    BarChart: Component, Bar: Component, XAxis: Component, YAxis: Component, CartesianGrid: Component,
    Tooltip: Component, ResponsiveContainer: Component, PieChart: Component, Pie: Component, Cell: Component,
    LineChart: Component, Line: Component, AreaChart: Component, Area: Component, Legend: Component,
  };
});

import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import App from '../App';

const seller = {
  id: 'seller-1', name: 'Pedro Vidal', email: 'vendas@enervita.com.br', role: 'vendedor', roles: ['vendedor'],
  permissions: ['activity.create','lead.create','lead.edit','lead.mark_lost','lead.stage_change','lead.view','page.dashboard','page.lead_detail','page.leads','page.pipeline','page.proposals','page.tasks','proposal.create','proposal.edit','proposal.send','proposal.view','task.complete','task.create','task.reschedule'],
  allowedStages: ['novo_lead','contato_realizado','qualificado','proposta_enviada','negociacao','contrato_assinado','perdido','ganho'],
};
const admin = {
  id: 'admin-1', name: 'João Paulo', email: 'joaopaulo@enervita.com.br', role: 'admin', roles: ['admin'],
  permissions: ['page.dashboard','page.leads','page.lead_detail','page.pipeline','page.tasks','page.proposals','page.automations','page.webhooks','page.analytics','page.ads','page.ai_assistant','page.settings','user.manage','settings.manage','analytics.view','tracking.view','ads.view','automation.manage','webhook.manage','webhook.test','lead.view','proposal.view'],
  allowedStages: ['novo_lead','contato_realizado','qualificado','proposta_enviada','negociacao','contrato_assinado','perdido','ganho'],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchFor(user: typeof seller) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/me') return jsonResponse({ user });
    if (url === '/api/auth/logout' && init?.method === 'POST') return jsonResponse({ ok: true });
    if (url.startsWith('/api/dashboard')) return jsonResponse({ metrics: { newLeadsToday: 0, leadsWithoutFollowup: 0, overdueTasks: 0, openProposals: 0, leadsBySource: [], leadsByStage: [], conversionsByPlatform: [], recentEvents: [] } });
    if (url.startsWith('/api/leads')) return jsonResponse({ leads: [], lead: null, history: [], tasks: [], activities: [], proposals: [], events: [] });
    if (url.startsWith('/api/tasks')) return jsonResponse({ tasks: [] });
    if (url.startsWith('/api/proposals')) return jsonResponse({ proposals: [] });
    if (url.startsWith('/api/automations')) return jsonResponse({ automations: [], workflows: [] });
    if (url.startsWith('/api/webhooks')) return jsonResponse({ webhooks: [], deliveries: [] });
    if (url.startsWith('/api/analytics')) return jsonResponse({ overview: { filters: { days: 7, startDate: '2026-06-01', endDate: '2026-06-07' }, generatedAt: new Date().toISOString(), kpis: [], daily: [], funnel: [], trafficSources: [], campaigns: [], signals: [], trackingStatus: [], eventNames: [], recentLeads: [], notes: [] } });
    if (url.startsWith('/api/ads')) return jsonResponse({ overview: { accounts: [], campaigns: [], audiences: [], totals: {} }, result: {} });
    if (url.startsWith('/api/ai')) return jsonResponse({ error: 'LLM_NOT_CONFIGURED' }, 503);
    if (url.startsWith('/api/permissions')) return jsonResponse({ categories: {}, permissions: [], stages: [] });
    if (url.startsWith('/api/users')) return jsonResponse({ users: [] });
    return jsonResponse({ error: 'Not found' }, 404);
  });
}

const allowedForSeller = ['Dashboard', 'Leads', 'Pipeline', 'Tarefas', 'Propostas'];
const forbiddenForSeller = ['Automações', 'Analytics', 'Campanhas', 'Assistente IA', 'Configurações'];
const routeCases = [
  ['/', true], ['/leads', true], ['/pipeline', true], ['/tasks', true], ['/proposals', true],
  ['/automations', false], ['/webhooks', false], ['/analytics', false], ['/ads', false], ['/ai', false], ['/settings', false], ['/settings?tab=users', false], ['/users', false],
] as const;

describe('UI page permissions audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    window.history.pushState({}, '', '/');
  });

  it('seller sidebar only shows allowed pages and hides admin pages', async () => {
    vi.stubGlobal('fetch', mockFetchFor(seller));
    render(<App />);
    const nav = await screen.findByRole('navigation');
    for (const label of allowedForSeller) expect(within(nav).getByText(label)).toBeInTheDocument();
    for (const label of forbiddenForSeller) expect(within(nav).queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByText('Usuários e permissões')).not.toBeInTheDocument();
  });

  it.each(routeCases)('seller direct route %s matches permission expectation', async (path, allowed) => {
    vi.stubGlobal('fetch', mockFetchFor(seller));
    window.history.pushState({}, '', path);
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Validando sessão...')).not.toBeInTheDocument());
    if (allowed) expect(screen.queryByText('Sem permissão')).not.toBeInTheDocument();
    else expect(await screen.findByText('Sem permissão')).toBeInTheDocument();
  });

  it('admin sees full menu and can open protected pages in UI', async () => {
    vi.stubGlobal('fetch', mockFetchFor(admin));
    render(<App />);
    const nav = await screen.findByRole('navigation');
    for (const label of [...allowedForSeller, ...forbiddenForSeller]) expect(within(nav).getByText(label)).toBeInTheDocument();
    for (const [path] of routeCases) {
      cleanup();
      vi.stubGlobal('fetch', mockFetchFor(admin));
      window.history.pushState({}, '', path);
      render(<App />);
      await waitFor(() => expect(screen.queryByText('Validando sessão...')).not.toBeInTheDocument());
      expect(screen.queryByText('Sem permissão')).not.toBeInTheDocument();
    }
  });
});
