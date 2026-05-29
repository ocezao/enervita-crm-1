import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Component = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  return {
    BarChart: Component,
    Bar: Component,
    XAxis: Component,
    YAxis: Component,
    CartesianGrid: Component,
    Tooltip: Component,
    ResponsiveContainer: Component,
    PieChart: Component,
    Pie: Component,
    Cell: Component,
  };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const admin = { id: 'u1', name: 'Admin Enervita', email: 'admin@example.com', role: 'admin', roles: ['admin'], permissions: [], allowedStages: [] };
const restricted = { id: 'u2', name: 'Operador', email: 'op@example.com', roles: [], permissions: ['page.dashboard'], allowedStages: [] };
const manager = { id: 'u3', name: 'Gestor', email: 'gestor@example.com', roles: [], permissions: ['user.manage'], allowedStages: [] };

const catalog = {
  categories: { navigation: 'Navegação', lead: 'Leads', user: 'Usuários' },
  permissions: [
    { key: 'page.users', label: 'Acessar usuários', category: 'navigation', group: 'Páginas', kind: 'page' },
    { key: 'lead.view', label: 'Visualizar leads', category: 'lead', group: 'Leads', kind: 'action' },
    { key: 'user.manage', label: 'Gerenciar usuários', category: 'user', group: 'Usuários', kind: 'action' },
  ],
  stages: [
    { key: 'novo_lead', label: 'Novo lead', order: 1 },
    { key: 'qualificacao', label: 'Qualificação', order: 2 },
  ],
};

const users = [
  { id: 'user-1', tenantId: 'tenant-1', name: 'Ana Admin', email: 'ana@example.com', status: 'active', roles: [], permissions: ['lead.view'], allowedStages: ['novo_lead'], profile: { jobTitle: 'Closer', department: 'Comercial' } },
];

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchForUser(user: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/me') return jsonResponse({ user });
    if (url === '/api/dashboard') return jsonResponse({
    metrics: {
      newLeadsToday: 1,
      leadsWithoutFollowup: 0,
      overdueTasks: 0,
      openProposals: 0,
      leadsBySource: [],
      leadsByStage: [],
      conversionsByPlatform: [],
      recentEvents: [],
    },
  });
    if (url === '/api/permissions/catalog') return jsonResponse(catalog);
    if (url === '/api/users' && !init?.method) return jsonResponse({ users });
    if (url === '/api/users' && init?.method === 'POST') return jsonResponse({ user: { ...users[0], id: 'user-2', name: 'Novo Usuário' } }, 201);
    if (url === '/api/users/user-1' && init?.method === 'PATCH') return jsonResponse({ user: { ...users[0], permissions: ['lead.view', 'user.manage'], allowedStages: ['novo_lead', 'qualificacao'] } });
    if (url === '/api/users/user-1/reset-password' && init?.method === 'POST') return jsonResponse({ user: users[0] });
    return jsonResponse({ error: 'Not found' }, 404);
  });
}

describe('administração de usuários e permissões', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('mostra o menu de usuários para administrador', async () => {
    vi.stubGlobal('fetch', mockFetchForUser(admin));

    render(<App />);

    expect(await screen.findByRole('link', { name: /usuários e permissões/i })).toBeInTheDocument();
  });

  it('oculta o menu e bloqueia acesso direto para usuário sem permissão', async () => {
    vi.stubGlobal('fetch', mockFetchForUser(restricted));
    window.history.pushState({}, '', '/users');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /sem permissão/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuários e permissões/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^usuários e permissões$/i })).not.toBeInTheDocument();
  });

  it('renderiza catálogo e usuários mockados e salva payload com permissions e allowedStages', async () => {
    const fetchMock = mockFetchForUser(manager);
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/users');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /^usuários e permissões$/i })).toBeInTheDocument();
    expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
    expect(screen.getByText('Visualizar leads')).toBeInTheDocument();
    expect(screen.getByText('Novo lead')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Gerenciar usuários'));
    await userEvent.click(screen.getByText('Qualificação'));
    await userEvent.click(screen.getByRole('button', { name: /salvar usuário/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/user-1', expect.objectContaining({ method: 'PATCH' }));
    });
    const patchCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/users/user-1' && init?.method === 'PATCH');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      permissions: ['lead.view', 'user.manage'],
      allowedStages: ['novo_lead', 'qualificacao'],
    });
  });

  it('chama o endpoint correto para reset de senha', async () => {
    const fetchMock = mockFetchForUser(manager);
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/users');

    render(<App />);

    await screen.findByText('Ana Admin');
    await userEvent.type(screen.getByLabelText(/senha temporária para reset/i), 'SenhaTemporaria123!');
    await userEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/user-1/reset-password', expect.objectContaining({ method: 'POST' }));
    });
    const resetCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/users/user-1/reset-password' && init?.method === 'POST');
    expect(JSON.parse(String(resetCall?.[1]?.body))).toEqual({ temporaryPassword: 'SenhaTemporaria123!' });
  });
});
