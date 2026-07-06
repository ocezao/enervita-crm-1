/**
 * Definição do Funil Solar - Sistema de Energia Solar
 * 
 * Este arquivo é a "Source of Truth" para as etapas do pipeline solar.
 * Controla a ordem, nomes, gatilhos de integração (Meta CAPI) e regras de transição.
 */

import { PipelineStageConfig, CapiEventTrigger } from '../types/pipeline.types';

export const SOLAR_FUNNEL_STAGES: PipelineStageConfig[] = [
  {
    id: 'solar_new',
    key: 'new',
    name: 'Novo Lead',
    description: 'Lead capturado via formulário ou importação',
    order: 1,
    color: '#9CA3AF', // Gray
    capiTrigger: null,
    requiredFields: ['name', 'phone'],
    isFinal: false
  },
  {
    id: 'solar_contact',
    key: 'contact',
    name: 'Atendimento Iniciado',
    description: 'Primeiro contato realizado com sucesso',
    order: 2,
    color: '#3B82F6', // Blue
    capiTrigger: null,
    requiredFields: ['contacted_at'],
    isFinal: false
  },
  {
    id: 'solar_qualification',
    key: 'qualification',
    name: 'Elaboração de Proposta',
    description: 'Coleta de dados técnicos (conta de luz, telhado) e criação da proposta',
    order: 3,
    color: '#8B5CF6', // Violet
    // DISPARO CAPI #1: Lead Qualificado
    capiTrigger: {
      eventName: 'Lead',
      eventQuality: 0.8, // Qualidade alta pois já houve contato humano
      customData: { content_name: 'Proposta Solar Elaborada' }
    },
    requiredFields: ['monthly_energy_cost', 'roof_area'],
    isFinal: false
  },
  {
    id: 'solar_presentation',
    key: 'presentation',
    name: 'Apresentação de Proposta',
    description: 'Proposta enviada e apresentada ao cliente',
    order: 4,
    color: '#EC4899', // Pink
    capiTrigger: {
      eventName: 'ViewContent',
      eventQuality: 0.9,
      customData: { content_type: 'proposal', value: 'proposal_value' }
    },
    requiredFields: ['proposal_sent_at'],
    isFinal: false
  },
  {
    id: 'solar_negotiation',
    key: 'negotiation',
    name: 'Negociação / Follow-up',
    description: 'Cliente solicitou ajustes ou está analisando condições',
    order: 5,
    color: '#F59E0B', // Amber
    capiTrigger: null,
    requiredFields: [],
    isFinal: false
  },
  {
    id: 'solar_closing',
    key: 'closing',
    name: 'Fechamento',
    description: 'Acordo verbal fechado, aguardando burocracia',
    order: 6,
    color: '#10B981', // Emerald
    // DISPARO CAPI #2: Intenção de Compra Forte
    capiTrigger: {
      eventName: 'InitiateCheckout',
      eventQuality: 0.95,
      customData: { currency: 'BRL', num_items: 1 }
    },
    requiredFields: ['agreed_value'],
    isFinal: false
  },
  {
    id: 'solar_survey',
    key: 'survey',
    name: 'Vistoria / Estudo Técnico',
    description: 'Validação técnica presencial no local da instalação',
    order: 7,
    color: '#06B6D4', // Cyan
    capiTrigger: null,
    requiredFields: ['survey_date', 'technical_notes'],
    isFinal: false
  },
  {
    id: 'solar_contract_sign',
    key: 'contract_sign',
    name: 'Assinatura de Contrato',
    description: 'Contrato assinado digitalmente ou fisicamente',
    order: 8,
    color: '#6366F1', // Indigo
    // DISPARO CAPI #3: Compra Confirmada (Purchase)
    capiTrigger: {
      eventName: 'Purchase',
      eventQuality: 1.0,
      customData: { currency: 'BRL', transaction_id: 'contract_id' }
    },
    requiredFields: ['signed_contract_url'],
    isFinal: false
  },
  {
    id: 'solar_won',
    key: 'won',
    name: 'Ganho / Contrato Assinado',
    description: 'Pipeline concluído com sucesso. Projeto pronto para instalação.',
    order: 9,
    color: '#22C55E', // Green
    capiTrigger: null, // O disparo de Purchase já ocorreu na etapa anterior
    requiredFields: [],
    isFinal: true
  },
  {
    id: 'solar_lost',
    key: 'lost',
    name: 'Pedido Perdido',
    description: 'Lead desistiu em qualquer etapa do processo',
    order: 10,
    color: '#EF4444', // Red
    capiTrigger: null,
    requiredFields: ['lost_reason'],
    isFinal: true
  }
];

/**
 * Mapeamento rápido por chave para acesso O(1)
 */
export const SOLAR_FUNNEL_MAP: Record<string, PipelineStageConfig> = 
  SOLAR_FUNNEL_STAGES.reduce((acc, stage) => {
    acc[stage.key] = stage;
    return acc;
  }, {} as Record<string, PipelineStageConfig>);

/**
 * Helper para verificar se uma etapa possui gatilho CAPI
 */
export function hasCapiTrigger(stageKey: string): boolean {
  return !!SOLAR_FUNNEL_MAP[stageKey]?.capiTrigger;
}

/**
 * Helper para obter configuração CAPI de uma etapa
 */
export function getCapiTriggerConfig(stageKey: string): CapiEventTrigger | null {
  return SOLAR_FUNNEL_MAP[stageKey]?.capiTrigger || null;
}
