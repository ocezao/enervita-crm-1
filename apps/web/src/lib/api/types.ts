export type LeadStage =
  | 'novo_lead'
  | 'qualificacao'
  | 'atendimento_iniciado'
  | 'conta_recebida'
  | 'diagnostico'
  | 'proposta_enviada'
  | 'contrato_enervita'
  | 'perdido';

export type LeadStatus = 'aguardando' | 'em_andamento' | 'concluido' | 'cancelado';

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface Client {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  cnpj: string;
  status: string;
  websiteUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  consent: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Lead {
  id: string;
  contactId: string;
  clientId?: string;
  stage: LeadStage;
  qualificationStatus: string;
  leadSource: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  estimatedTicket: number;
  sdrOwner: string;
  firstResponseAt?: string;
  lastContactAt?: string;
  nextActionAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  energyBillValue: number;
  averageConsumptionKwh: number;
  concessionaria: string;
  offer: string;
  projectedSavings: number;
  priority: Priority;
  contact?: Contact; // Join result
}

export interface Task {
  id: string;
  leadId: string;
  title: string;
  status: 'pendente' | 'concluido' | 'atrasado';
  priority: Priority;
  owner: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  leadName?: string; // For display in task list
}

export interface Activity {
  id: string;
  leadId: string;
  contactId: string;
  activityType: 'call' | 'email' | 'whatsapp' | 'meeting' | 'note' | 'stage_change';
  outcome: string;
  responseTimeSeconds?: number;
  notes?: string;
  occurredAt: string;
  createdAt: string;
}

export interface TrackingEvent {
  id: string;
  leadId: string;
  platform: 'site' | 'meta' | 'ga4' | 'google_ads';
  eventName: string;
  status: 'queued' | 'sent' | 'failed';
  sentAt?: string;
  attempts: number;
  nextRetryAt?: string;
  errorMessage?: string;
  payload: Record<string, unknown>;
}


export interface Proposal {
  id: string;
  tenantId?: string;
  leadId: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'lost' | 'expired';
  monthlyBillValue: number;
  estimatedKwh: number;
  discountPercentage: number;
  projectedMonthlySavings: number;
  projectedAnnualSavings: number;
  validUntil?: string;
  sentAt?: string;
  acceptedAt?: string;
  lostAt?: string;
  lostReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  leadName?: string;
  leadStage?: LeadStage;
}

export type CreateProposalPayload = {
  leadId: string;
  title: string;
  monthlyBillValue: number;
  estimatedKwh?: number;
  discountPercentage: number;
  projectedMonthlySavings: number;
  projectedAnnualSavings: number;
  validUntil?: string;
  notes?: string;
};

export interface SyncMapping {
  id: string;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  targetSystem: string;
  targetObject: string;
  targetId: string;
  lastSyncedAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  active: boolean;
  lastRunAt?: string;
  status?: 'planned' | 'active' | 'paused';
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  status: 'planned' | 'active' | 'inactive' | 'failing';
  lastDeliveryAt?: string;
  successRate: number;
  secretConfigured?: boolean;
}

export interface DashboardMetrics {
  newLeadsToday: number;
  leadsWithoutFollowup: number;
  overdueTasks: number;
  openProposals: number;
  leadsBySource: { source: string; count: number }[];
  leadsByStage: { stage: LeadStage; count: number }[];
  conversionsByPlatform: { platform: string; count: number }[];
  recentEvents: Activity[];
}
