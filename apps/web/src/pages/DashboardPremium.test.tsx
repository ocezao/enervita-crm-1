import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPremium from './DashboardPremium';
import type { DashboardMetrics } from '../lib/api/types';

const baseMetrics: DashboardMetrics = {
  newLeadsToday: 8,
  leadsWithoutFollowup: 0,
  overdueTasks: 0,
  openProposals: 0,
  leadsBySource: [],
  leadsByStage: [
    { stage: 'proposta_enviada', count: 2 },
    { stage: 'novo_lead', count: 3 },
    { stage: 'contrato_enervita', count: 1 },
    { stage: 'qualificacao', count: 2 },
  ],
  leadsBySeller: [],
  conversionsByPlatform: [],
  recentEvents: [],
  commercial: {
    openOpportunityValue: 0,
    wonOpportunityValue: 0,
    openOpportunities: 0,
    wonOpportunities: 0,
    openProposals: 0,
    acceptedProposals: 0,
    acceptedProposalAnnualValue: 0,
    overdueTasks: 0,
    leadsWithoutNextAction: 0,
    staleLeads: 0,
    stageBreakdown: [
      { stage: 'proposta_enviada', count: 2, value: 2000 },
      { stage: 'novo_lead', count: 3, value: 3000 },
      { stage: 'contrato_enervita', count: 1, value: 1000 },
    ],
    attentionLeads: [],
  },
};

let mockedMetrics = baseMetrics;

vi.mock('../hooks/useCrm', () => ({
  useDashboardMetrics: () => ({ metrics: mockedMetrics, loading: false }),
}));

describe('DashboardPremium funnel', () => {
  beforeEach(() => {
    mockedMetrics = baseMetrics;
  });

  it('renders the funnel in the fixed pipeline order', () => {
    render(<DashboardPremium />);

    const expectedOrder = [
      'funnel-stage-novo_lead',
      'funnel-stage-qualificacao',
      'funnel-stage-atendimento_iniciado',
      'funnel-stage-conta_recebida',
      'funnel-stage-diagnostico',
      'funnel-stage-proposta_enviada',
      'funnel-stage-contrato_enervita',
      'funnel-stage-perdido',
    ];

    const elements = expectedOrder.map((testId) => screen.getByTestId(testId));
    for (let index = 0; index < elements.length - 1; index += 1) {
      expect(elements[index].compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(expectedOrder.map((testId) => screen.getByTestId(testId).textContent)).toEqual([
      expect.stringContaining('Novo lead'),
      expect.stringContaining('Qualificação'),
      expect.stringContaining('Atendimento iniciado'),
      expect.stringContaining('Conta recebida'),
      expect.stringContaining('Diagnóstico'),
      expect.stringContaining('Proposta enviada'),
      expect.stringContaining('Contrato Enervita'),
      expect.stringContaining('Perdido'),
    ]);
  });

  it('keeps stage colors stable when API data order changes', () => {
    const { rerender } = render(<DashboardPremium />);
    const proposalBefore = screen.getByTestId('funnel-stage-color-proposta_enviada').getAttribute('style');
    const novoBefore = screen.getByTestId('funnel-stage-color-novo_lead').getAttribute('style');

    mockedMetrics = {
      ...baseMetrics,
      leadsByStage: [...baseMetrics.leadsByStage].reverse(),
      commercial: {
        ...baseMetrics.commercial,
        stageBreakdown: [...baseMetrics.commercial.stageBreakdown].reverse(),
      },
    };
    rerender(<DashboardPremium />);

    expect(screen.getByTestId('funnel-stage-color-proposta_enviada').getAttribute('style')).toBe(proposalBefore);
    expect(screen.getByTestId('funnel-stage-color-novo_lead').getAttribute('style')).toBe(novoBefore);
  });
});
