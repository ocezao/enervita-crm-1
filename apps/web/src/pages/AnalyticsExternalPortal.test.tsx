import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Component = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  return {
    AreaChart: Component,
    Area: Component,
    BarChart: Component,
    Bar: Component,
    CartesianGrid: Component,
    Cell: Component,
    PieChart: Component,
    Pie: Component,
    ResponsiveContainer: Component,
    Tooltip: Component,
    XAxis: Component,
    YAxis: Component,
  };
});

import { render, screen } from '@testing-library/react';
import App from '../App';

const admin = {
  id: 'admin-1',
  name: 'Admin Enervita',
  email: 'admin@enervita.com.br',
  roles: ['admin'],
  avatarUrl: null,
  permissions: ['page.analytics', 'analytics.view'],
  allowedStages: [],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Analytics external portal access', () => {
  it('shows a dedicated section linking to analytics.enervita.com.br from the CRM analytics page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user: admin });
      if (url.startsWith('/api/analytics')) {
        return jsonResponse({
          overview: {
            filters: {},
            generatedAt: new Date().toISOString(),
            kpis: [],
            daily: [],
            funnel: [],
            trafficSources: [],
            campaigns: [],
            signals: [],
            trackingStatus: [],
            eventNames: [],
            recentLeads: [],
            notes: [],
          },
        });
      }
      return jsonResponse({ error: 'Not found' }, 404);
    }));
    window.history.pushState({}, '', '/analytics');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /analytics comercial/i })).toBeInTheDocument();
    const portalLink = screen.getByRole('link', { name: /abrir analytics externo/i });
    expect(portalLink).toHaveAttribute('href', 'https://analytics.enervita.com.br/');
    expect(portalLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/painel externo/i)).toBeInTheDocument();
  });
});
