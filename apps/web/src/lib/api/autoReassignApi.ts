export type AutoReassignConfig = {
  enabled: boolean;
  activatedAt: string | null;
  afterHours: number;
};

export type AutoReassignStats = {
  totalReassigned: number;
  maxedOut: number;
  eligibleNow: number;
};

export type AutoReassignResponse = {
  config: AutoReassignConfig;
  stats: AutoReassignStats;
};

export const autoReassignApi = {
  async get(): Promise<AutoReassignResponse> {
    const res = await fetch('/api/auto-reassign', { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao carregar configuracao de reatribuicao');
    return res.json();
  },

  async update(enabled: boolean): Promise<{ config: AutoReassignConfig }> {
    const res = await fetch('/api/auto-reassign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Erro ao atualizar reatribuicao automatica');
    return res.json();
  },
};
