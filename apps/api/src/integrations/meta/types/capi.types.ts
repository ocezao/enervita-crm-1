/**
 * Tipos específicos para integração Meta Conversions API (CAPI)
 * Garante tipagem estrita para payloads de eventos e respostas
 */

export interface MetaUserData {
  email?: string; // Hashed SHA-256
  phone?: string; // Hashed SHA-256
  fn?: string; // First Name Hashed
  ln?: string; // Last Name Hashed
  city?: string;
  st?: string; // State
  zip?: string;
  country?: string;
  external_id?: string; // Internal Lead ID Hashed
}

export interface MetaEventData {
  event_name: string;
  event_time: number;
  action_source: 'website' | 'call_center' | 'email' | 'chat' | 'physical_store' | 'app' | 'other';
  event_source_url?: string;
  opt_out?: boolean;
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: 'product' | 'service';
    [key: string]: any;
  };
}

export interface MetaCapiPayload {
  data: Array<{
    user_data: MetaUserData;
    events: MetaEventData[];
  }>;
  test_event_code?: string; // Para modo de teste
}

export interface MetaCapiResponse {
  events_received: number;
  messages: Array<{
    code: string;
    message: string;
    type: 'ERROR' | 'WARNING' | 'INFO';
  }>;
  fb_trace_id?: string;
}

export type CapiEventName = 
  | 'Lead' 
  | 'CompleteRegistration' 
  | 'ViewContent' 
  | 'InitiateCheckout' 
  | 'Purchase' 
  | 'Contact' 
  | 'Custom';

export interface CapiTriggerConfig {
  stageKey: string;
  eventName: CapiEventName;
  includeValue: boolean; // Se deve enviar o valor da proposta no evento
  minDataQuality: 'low' | 'medium' | 'high'; // Nível mínimo de dados para disparar
}
