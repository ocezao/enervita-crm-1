import { Lead, Contact, Task, AutomationRule, Webhook, Activity } from '../lib/api/types';

export const mockContacts: Contact[] = [
  {
    id: 'c1',
    name: 'João Silva',
    email: 'joao@padariasilva.com.br',
    phone: '(11) 98888-7777',
    company: 'Padaria Silva',
    source: 'Meta Ads',
    consent: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'c2',
    name: 'Mariana Costa',
    email: 'mariana@clinicaestetica.com.br',
    phone: '(21) 97777-6666',
    company: 'Clínica Costa',
    source: 'Google Ads',
    consent: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'c3',
    name: 'Roberto Almeida',
    email: 'roberto@mercadoalmeida.com.br',
    phone: '(31) 96666-5555',
    company: 'Mercado Almeida',
    source: 'Indicação',
    consent: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'c4',
    name: 'Carla Menezes',
    email: 'carla@restaurante.com.br',
    phone: '(41) 95555-4444',
    company: 'Restaurante Sabor',
    source: 'Orgânico',
    consent: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'c5',
    name: 'Henrique Lopes',
    email: 'henrique@servicoslopes.com.br',
    phone: '(51) 94444-3333',
    company: 'Lopes Serviços',
    source: 'Direto',
    consent: true,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  }
];

export const mockLeads: Lead[] = [
  {
    id: 'l1',
    contactId: 'c1',
    stage: 'proposta_enviada',
    qualificationStatus: 'Qualificado',
    leadSource: 'Meta Ads',
    utmSource: 'facebook',
    utmMedium: 'cpc',
    utmCampaign: 'solar_leads_sp',
    estimatedTicket: 15000,
    sdrOwner: 'Carlos SDR',
    createdAt: mockContacts[0].createdAt,
    updatedAt: new Date().toISOString(),
    energyBillValue: 1250,
    averageConsumptionKwh: 450,
    concessionaria: 'Enel SP',
    offer: 'Assinatura Residencial',
    projectedSavings: 180,
    priority: 'alta',
    contact: mockContacts[0]
  },
  {
    id: 'l2',
    contactId: 'c2',
    stage: 'atendimento_iniciado',
    qualificationStatus: 'Em análise',
    leadSource: 'Google Ads',
    utmSource: 'google',
    utmMedium: 'search',
    utmCampaign: 'energia_solar_rj',
    estimatedTicket: 12000,
    sdrOwner: 'Ana SDR',
    createdAt: mockContacts[1].createdAt,
    updatedAt: new Date().toISOString(),
    energyBillValue: 890,
    averageConsumptionKwh: 320,
    concessionaria: 'Light',
    offer: 'Assinatura Comercial',
    projectedSavings: 110,
    priority: 'media',
    contact: mockContacts[1]
  },
  {
    id: 'l3',
    contactId: 'c3',
    stage: 'novo_lead',
    qualificationStatus: 'Novo',
    leadSource: 'Indicação',
    estimatedTicket: 35000,
    sdrOwner: 'Carlos SDR',
    createdAt: mockContacts[2].createdAt,
    updatedAt: new Date().toISOString(),
    energyBillValue: 2400,
    averageConsumptionKwh: 850,
    concessionaria: 'Cemig',
    offer: 'UFV Própria',
    projectedSavings: 450,
    priority: 'urgente',
    contact: mockContacts[2]
  },
  {
    id: 'l4',
    contactId: 'c4',
    stage: 'conta_recebida',
    qualificationStatus: 'Qualificado',
    leadSource: 'Orgânico',
    estimatedTicket: 22000,
    sdrOwner: 'Ana SDR',
    createdAt: mockContacts[3].createdAt,
    updatedAt: new Date().toISOString(),
    energyBillValue: 1780,
    averageConsumptionKwh: 640,
    concessionaria: 'Copel',
    offer: 'Assinatura Comercial',
    projectedSavings: 280,
    priority: 'media',
    contact: mockContacts[3]
  },
  {
    id: 'l5',
    contactId: 'c5',
    stage: 'qualificacao',
    qualificationStatus: 'Em triagem',
    leadSource: 'Direto',
    estimatedTicket: 8000,
    sdrOwner: 'Carlos SDR',
    createdAt: mockContacts[4].createdAt,
    updatedAt: new Date().toISOString(),
    energyBillValue: 650,
    averageConsumptionKwh: 210,
    concessionaria: 'Ceee',
    offer: 'Assinatura Residencial',
    projectedSavings: 75,
    priority: 'baixa',
    contact: mockContacts[4]
  }
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    leadId: 'l1',
    title: 'Follow-up proposta enviada',
    status: 'atrasado',
    priority: 'urgente',
    owner: 'Carlos SDR',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    leadName: 'João Silva'
  },
  {
    id: 't2',
    leadId: 'l2',
    title: 'Solicitar conta de luz',
    status: 'pendente',
    priority: 'alta',
    owner: 'Ana SDR',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    leadName: 'Mariana Costa'
  }
];

export const mockAutomations: AutomationRule[] = [
  {
    id: 'a1',
    name: 'Alerta Lead VIP',
    trigger: 'Lead Criado',
    conditions: ['Valor da conta > 2000'],
    actions: ['Definir Prioridade: Urgente', 'Notificar SDR'],
    active: true,
    lastRunAt: new Date().toISOString()
  },
  {
    id: 'a2',
    name: 'Follow-up Automático',
    trigger: 'Lead sem contato por 24h',
    conditions: ['Estágio != Perdido'],
    actions: ['Criar Tarefa: Follow-up'],
    active: true,
    lastRunAt: new Date().toISOString()
  }
];

export const mockWebhooks: Webhook[] = [
  {
    id: 'w1',
    name: 'n8n Production',
    url: 'https://n8n.enervita.com.br/webhook/leads',
    eventTypes: ['lead.created', 'lead.stage_changed'],
    status: 'active',
    lastDeliveryAt: new Date().toISOString(),
    successRate: 98.5
  }
];

export const mockActivities: Activity[] = [
  {
    id: 'act1',
    leadId: 'l1',
    contactId: 'c1',
    activityType: 'call',
    outcome: 'Apresentou proposta, cliente vai analisar com o sócio',
    occurredAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: 'act2',
    leadId: 'l1',
    contactId: 'c1',
    activityType: 'stage_change',
    outcome: 'Alterado para Proposta Enviada',
    occurredAt: new Date(Date.now() - 3600000 * 25).toISOString(),
    createdAt: new Date().toISOString()
  }
];
