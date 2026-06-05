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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const dashboardMetrics = {
  newLeadsToday: 7,
  leadsWithoutFollowup: 2,
  overdueTasks: 1,
  openProposals: 3,
  leadsBySource: [{ source: 'Meta Ads', count: 4 }],
  leadsByStage: [],
  conversionsByPlatform: [{ platform: 'Meta', count: 2 }],
  recentEvents: [],
};

const seller = {
  id: 'seller-1', name: 'Pedro Vidal', email: 'vendas@enervita.com.br', roles: ['vendedor'], avatarUrl: null,
  permissions: ['page.dashboard','page.leads','page.pipeline','page.tasks','lead.view','task.create','proposal.view'],
  allowedStages: ['novo_lead','qualificacao'],
};

const admin = {
  id: 'admin-1', name: 'João Paulo', email: 'joaopaulo@enervita.com.br', roles: ['admin'], avatarUrl: 'https://cdn.enervita.test/admin.png',
  permissions: ['page.dashboard','page.leads','page.pipeline','page.tasks','page.analytics','page.ads','page.settings','user.manage','analytics.view','ads.view'],
  allowedStages: ['novo_lead','qualificacao','diagnostico','proposta_enviada'],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchFor(user: typeof seller, updated: typeof seller | typeof admin = user) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/me' && !init?.method) return jsonResponse({ user });
    if (url === '/api/me' && init?.method === 'PATCH') return jsonResponse({ user: updated });
    if (url === '/api/me/avatar' && init?.method === 'POST') return jsonResponse({ user: updated });
    if (url === '/api/me/password' && init?.method === 'POST') return jsonResponse({ ok: true });
    if (url === '/api/auth/logout' && init?.method === 'POST') return jsonResponse({ ok: true });
    if (url.startsWith('/api/dashboard')) return jsonResponse({ metrics: dashboardMetrics });
    if (url.startsWith('/api/leads')) return jsonResponse({ leads: [], lead: null, history: [], tasks: [], activities: [] });
    if (url.startsWith('/api/tasks')) return jsonResponse({ tasks: [] });
    if (url.startsWith('/api/proposals')) return jsonResponse({ proposals: [] });
    if (url.startsWith('/api/analytics')) return jsonResponse({ overview: { filters: {}, generatedAt: new Date().toISOString(), kpis: [], daily: [], funnel: [], trafficSources: [], campaigns: [], signals: [], trackingStatus: [], eventNames: [], recentLeads: [], notes: [] } });
    if (url.startsWith('/api/ads')) return jsonResponse({ overview: { accounts: [], campaigns: [], audiences: [], totals: {} } });
    if (url.startsWith('/api/permissions')) return jsonResponse({ categories: {}, permissions: [], stages: [] });
    if (url.startsWith('/api/users')) return jsonResponse({ users: [] });
    return jsonResponse({ error: 'Not found' }, 404);
  });
}

describe('User profile page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/profile');
  });

  it('is the same personal page for a seller and only summarizes pages they can access', async () => {
    vi.stubGlobal('fetch', mockFetchFor(seller));
    render(<App />);

    expect(await screen.findByRole('heading', { name: /minha página/i })).toBeInTheDocument();
    expect(screen.getByText(/ambiente pessoal de pedro vidal/i)).toBeInTheDocument();
    const summary = screen.getByTestId('profile-access-summary');
    expect(within(summary).getByText('Dashboard')).toBeInTheDocument();
    expect(within(summary).getByText('Leads')).toBeInTheDocument();
    expect(within(summary).queryByText('Analytics')).not.toBeInTheDocument();
    expect(within(summary).queryByText('Campanhas')).not.toBeInTheDocument();
    expect(await screen.findByText(/novos leads hoje/i)).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
  });

  it('shows broader summary cards for admin because they have more permissions', async () => {
    vi.stubGlobal('fetch', mockFetchFor(admin));
    render(<App />);

    expect(await screen.findByRole('heading', { name: /minha página/i })).toBeInTheDocument();
    const summary = screen.getByTestId('profile-access-summary');
    expect(within(summary).getByText('Analytics')).toBeInTheDocument();
    expect(within(summary).getByText('Campanhas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /administrar usuários/i })).toBeInTheDocument();
  });

  it('keeps /users administration protected while /profile is open to common logged users', async () => {
    vi.stubGlobal('fetch', mockFetchFor(seller));
    window.history.pushState({}, '', '/users');
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Validando sessão...')).not.toBeInTheDocument());
    expect(await screen.findByText('Sem permissão')).toBeInTheDocument();
  });

  it('saves name, email, avatar and password for the current logged user', async () => {
    const updated = { ...seller, name: 'Pedro Solar', email: 'pedro@enervita.com.br', avatarUrl: 'https://cdn.enervita.test/pedro.png' };
    const fetchMock = mockFetchFor(seller, updated);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    await screen.findByRole('heading', { name: /minha página/i });
    await userEvent.clear(screen.getByLabelText(/nome de exibição/i));
    await userEvent.type(screen.getByLabelText(/nome de exibição/i), 'Pedro Solar');
    await userEvent.clear(screen.getByLabelText(/^email/i));
    await userEvent.type(screen.getByLabelText(/^email/i), 'pedro@enervita.com.br');
    await userEvent.type(screen.getByLabelText(/url da foto/i), 'https://cdn.enervita.test/pedro.png');
    await userEvent.click(screen.getByRole('button', { name: /salvar personalização/i }));

    expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'PATCH', credentials: 'include' }));
    await userEvent.type(screen.getByLabelText(/senha atual/i), 'SenhaSegura123!');
    await userEvent.type(screen.getByLabelText(/nova senha/i), 'NovaSenhaSegura123!');
    await userEvent.click(screen.getByRole('button', { name: /alterar senha/i }));
    expect(fetchMock).toHaveBeenCalledWith('/api/me/password', expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(await screen.findByText(/perfil atualizado/i)).toBeInTheDocument();
  });

  it('uploads a local avatar file from the personal page and updates the visible photo', async () => {
    const updated = { ...seller, avatarUrl: '/uploads/avatars/seller-1-avatar.png' };
    const fetchMock = mockFetchFor(seller, updated);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    await screen.findByRole('heading', { name: /minha página/i });
    const avatar = new File(['fake image'], 'avatar.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/enviar foto local/i), avatar);

    expect(fetchMock).toHaveBeenCalledWith('/api/me/avatar', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: expect.any(FormData),
    }));
    expect(await screen.findByRole('img', { name: /foto do usuário/i })).toHaveAttribute('src', '/uploads/avatars/seller-1-avatar.png');
    expect(await screen.findByText(/foto enviada/i)).toBeInTheDocument();
  });
});
