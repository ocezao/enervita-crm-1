/**
 * Tipos e Interfaces para Configuração de Pipelines e Integração Meta CAPI
 */

/**
 * Configuração de disparo para Conversions API (Meta/Facebook)
 */
export interface CapiEventTrigger {
  /** Nome do evento padrão do Meta (Lead, Purchase, InitiateCheckout, etc.) */
  eventName: string;
  /** Qualidade do evento (0.0 a 1.0) para otimização de campanhas */
  eventQuality?: number;
  /** Dados customizados específicos do evento */
  customData?: Record<string, any>;
}

/**
 * Configuração completa de uma etapa do pipeline
 */
export interface PipelineStageConfig {
  /** ID único no banco de dados (ex: 'solar_new') */
  id: string;
  /** Chave curta para uso no código (ex: 'new') */
  key: string;
  /** Nome exibido na UI */
  name: string;
  /** Descrição da etapa para tooltips e ajuda */
  description: string;
  /** Ordem numérica para ordenação */
  order: number;
  /** Cor hexadecimal para identificação visual no Kanban */
  color: string;
  /** Gatilho de integração CAPI (null se não houver) */
  capiTrigger: CapiEventTrigger | null;
  /** Campos obrigatórios que devem estar preenchidos antes de avançar desta etapa */
  requiredFields: string[];
  /** Indica se é uma etapa final (won/lost) */
  isFinal: boolean;
}

/**
 * Payload normalizado para envio ao Meta CAPI
 */
export interface MetaCapiPayload {
  data: [
    {
      event_name: string;
      event_time: number;
      action_source: string;
      event_id?: string;
      user_data: {
        em?: string; // Email hash
        ph?: string; // Phone hash
        fn?: string; // First name hash
        ln?: string; // Last name hash
        ct?: string; // City hash
        st?: string; // State hash
        zip?: string; // Zip code hash
        country?: string;
      };
      custom_data?: {
        currency?: string;
        value?: number;
        content_name?: string;
        content_type?: string;
        content_ids?: string[];
        num_items?: number;
        order_id?: string;
        [key: string]: any;
      };
      event_quality_score?: number;
    }
  ];
  test_event_code?: string;
}

/**
 * Resposta da API do Meta
 */
export interface MetaCapiResponse {
  events_received: number;
  messages: Array<{
    code: number;
    message: string;
    type?: string;
  }>;
  fbtrace_id: string;
}

/**
 * Log de auditoria para disparos CAPI
 */
export interface CapiLogEntry {
  id?: string;
  leadId: string;
  stageKey: string;
  eventName: string;
  status: 'success' | 'error' | 'pending';
  payloadSent: MetaCapiPayload;
  metaResponse?: MetaCapiResponse;
  errorMessage?: string;
  createdAt: Date;
}
