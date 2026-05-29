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

const user = { id: 'u1', name: 'Cesar Machado', email: 'cesar@example.com', role: 'admin' };

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockFetchWithDashboard(userResponse: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/me') return jsonResponse({ user: userResponse });
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
    if (url === '/api/auth/logout' && init?.method === 'POST') return jsonResponse({ ok: true });
    return jsonResponse({ error: 'Not found' }, 404);
  });
}

describe('App auth flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('redirects private routes to the login page when there is no session', async () => {
    window.history.pushState({}, '', '/settings');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401)));

    render(<App />);

    expect(await screen.findByRole('heading', { name: /entrar no cockpit enervita/i })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('renders private CRM content when a valid session exists', async () => {
    vi.stubGlobal('fetch', mockFetchWithDashboard(user));

    render(<App />);

    expect(await screen.findByText(/cockpit comercial/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /entrar no cockpit enervita/i })).not.toBeInTheDocument();
  });

  it('logs out from the topbar and sends the operator back to login', async () => {
    const fetchMock = mockFetchWithDashboard(user);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByText(/cockpit comercial/i, {}, { timeout: 2000 });
    await userEvent.click(screen.getByRole('button', { name: /sair/i }));

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', credentials: 'include' });
    expect(await screen.findByRole('heading', { name: /entrar no cockpit enervita/i })).toBeInTheDocument();
  });
});
