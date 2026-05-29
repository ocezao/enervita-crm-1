export type AutomationStatus = 'planned' | 'active' | 'paused';
export type WebhookStatus = 'planned' | 'active' | 'inactive' | 'failing';

export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  active: boolean;
  status: AutomationStatus;
  lastRunAt?: string;
};

export type WebhookDefinition = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  status: WebhookStatus;
  lastDeliveryAt?: string;
  successRate: number;
  secretConfigured: boolean;
};

const AUTOMATIONS: AutomationRule[] = [
  {
    id: 'lead-no-followup-12h',
    name: 'Alerta de lead sem follow-up em 12h',
    trigger: 'lead.no_followup_12h',
    conditions: ['Lead em etapas comerciais sem atividade recente', 'Sem tarefa aberta para o responsável'],
    actions: ['Criar tarefa urgente para SDR', 'Notificar responsável comercial'],
    active: false,
    status: 'planned',
  },
  {
    id: 'proposal-open-48h',
    name: 'Retorno de proposta aberta em 48h',
    trigger: 'proposal.open_48h',
    conditions: ['Lead na etapa proposta_enviada', 'Sem atividade de retorno registrada'],
    actions: ['Criar tarefa de follow-up', 'Sugerir mensagem WhatsApp'],
    active: false,
    status: 'planned',
  },
];

const WEBHOOKS: WebhookDefinition[] = [
  {
    id: 'n8n-lead-created',
    name: 'n8n - lead criado',
    url: 'https://n8n.enervita.com.br/webhook/lead-created',
    eventTypes: ['lead.created'],
    status: 'planned',
    successRate: 0,
    secretConfigured: false,
  },
  {
    id: 'n8n-stage-changed',
    name: 'n8n - mudança de etapa',
    url: 'https://n8n.enervita.com.br/webhook/lead-stage-changed',
    eventTypes: ['lead.stage_changed'],
    status: 'planned',
    successRate: 0,
    secretConfigured: false,
  },
];

export function listAutomations(): AutomationRule[] {
  return AUTOMATIONS.map((automation) => ({ ...automation, conditions: [...automation.conditions], actions: [...automation.actions] }));
}

export function listWebhooks(): WebhookDefinition[] {
  return WEBHOOKS.map((webhook) => ({ ...webhook, eventTypes: [...webhook.eventTypes] }));
}

export class IntegrationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationNotFoundError';
  }
}

export function testWebhook(id: string): { success: boolean; message: string } {
  const webhook = WEBHOOKS.find((candidate) => candidate.id === id);
  if (!webhook) throw new IntegrationNotFoundError('Webhook não encontrado');
  return {
    success: true,
    message: `Webhook ${webhook.name} validado em dry-run; nenhum payload externo foi enviado.`,
  };
}
