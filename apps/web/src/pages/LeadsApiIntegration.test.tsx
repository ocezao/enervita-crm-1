
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
import App from '../App';

const user = {
  id: 'user-1',
  name: 'Operador Leads',
  email: 'operador@example.com',
  roles: [],
  permissions: ['page.dashboard', 'lead.view'],
  allowedStages: ['novo_lead'],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Leads page real API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/leads');
  });

  it('loads leads from the backend API instead of mock data and hides CSV export without permission', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ user });
      if (url === '/api/leads') {
        return jsonResponse({
          leads: [
            {
              id: 'lead-real-1',
              contactId: 'contact-1',
              stage: 'novo_lead',
              qualificationStatus: 'qualificado',
              leadSource: 'site',
              estimatedTicket: '900',
              priority: 'alta',
              createdAt: '2026-05-29T00:00:00.000Z',
              updatedAt: '2026-05-29T01:00:00.000Z',
              contact: { id: 'contact-1', name: 'Lead Real API', email: 'lead@example.com', phone: null, company: 'Empresa Real', source: 'site', consent: true, createdAt: '2026-05-29T00:00:00.000Z' },
            },
          ],
        });
      }
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Lead Real API')).toBeInTheDocument();
    expect(screen.getByText('Empresa Real')).toBeInTheDocument();
    expect(screen.queryByText('Exportar CSV')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/leads', { credentials: 'include' });
    });
  });
});
