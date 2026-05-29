import {
  Lead,
  Task,
  Activity,
  AutomationRule,
  AutomationRun,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
  DashboardMetrics,
  Proposal,
  CreateProposalPayload,
  TrackingEvent,
  LeadStage,
  Priority,
} from './types';

export interface CrmApi {
  listLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLeadStage(id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string }): Promise<Lead>;

  listProposals(): Promise<Proposal[]>;
  listProposalsForLead(leadId: string): Promise<Proposal[]>;
  createProposal(payload: CreateProposalPayload): Promise<Proposal>;
  listTrackingEventsForLead(leadId: string): Promise<TrackingEvent[]>;

  listTasks(): Promise<Task[]>;
  listTasksForLead(leadId: string): Promise<Task[]>;
  createTask(payload: Partial<Task>): Promise<Task>;
  completeTask(id: string): Promise<Task>;

  listActivities(leadId: string): Promise<Activity[]>;
  createActivity(payload: Partial<Activity>): Promise<Activity>;

  listDashboardMetrics(): Promise<DashboardMetrics>;

  listAutomations(): Promise<AutomationRule[]>;
  runAutomation(id: string, payload?: Record<string, unknown>): Promise<AutomationRun>;

  listWebhooks(): Promise<Webhook[]>;
  listWebhookDeliveries(): Promise<WebhookDelivery[]>;
  testWebhook(id: string): Promise<WebhookTestResult>;
}

type BackendContact = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  consent?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BackendLead = {
  id: string;
  tenantId?: string;
  contactId: string;
  stage: LeadStage;
  qualificationStatus?: string | null;
  leadSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  estimatedTicket?: string | number | null;
  sdrOwnerId?: string | null;
  priority?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  contact?: BackendContact | null;
};

type BackendProposal = {
  id: string;
  tenantId?: string;
  leadId: string;
  title: string;
  status: Proposal['status'];
  monthlyBillValue?: string | number | null;
  estimatedKwh?: string | number | null;
  discountPercentage?: string | number | null;
  projectedMonthlySavings?: string | number | null;
  projectedAnnualSavings?: string | number | null;
  validUntil?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  leadName?: string | null;
  leadStage?: LeadStage | null;
};

type BackendTrackingEvent = TrackingEvent;

type BackendTask = {
  id: string;
  tenantId?: string;
  leadId?: string | null;
  title: string;
  description?: string | null;
  status: 'pendente' | 'concluido' | 'atrasado' | 'cancelado';
  priority?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leadName?: string | null;
};

type BackendActivity = {
  id: string;
  leadId: string;
  contactId?: string | null;
  activityType: Activity['activityType'];
  outcome?: string | null;
  responseTimeSeconds?: number | null;
  notes?: string | null;
  occurredAt: string;
  createdAt: string;
};

type ApiErrorBody = { error?: string };

function numeric(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stringFromMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[], fallback = ''): string {
  if (!metadata) return fallback;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string') return value;
  }
  return fallback;
}

function numberFromMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[], fallback = 0): number {
  if (!metadata) return fallback;
  for (const key of keys) {
    const value = metadata[key];
    const parsed = numeric(value, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function priority(value: string | null | undefined): Priority {
  return value === 'baixa' || value === 'alta' || value === 'urgente' ? value : 'media';
}

function mapLead(raw: BackendLead): Lead {
  const metadata = raw.metadata ?? {};
  const contact = raw.contact ?? {};
  return {
    id: raw.id,
    contactId: raw.contactId,
    clientId: raw.tenantId,
    stage: raw.stage,
    qualificationStatus: raw.qualificationStatus ?? 'aguardando',
    leadSource: raw.leadSource ?? contact.source ?? 'desconhecido',
    utmSource: raw.utmSource ?? undefined,
    utmMedium: raw.utmMedium ?? undefined,
    utmCampaign: raw.utmCampaign ?? undefined,
    utmContent: raw.utmContent ?? undefined,
    utmTerm: raw.utmTerm ?? undefined,
    estimatedTicket: numeric(raw.estimatedTicket),
    sdrOwner: raw.sdrOwnerId ?? 'Sem responsável',
    notes: raw.notes ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    energyBillValue: numberFromMetadata(metadata, ['energyBillValue', 'billValue', 'contaMediaMensal']),
    averageConsumptionKwh: numberFromMetadata(metadata, ['averageConsumptionKwh', 'consumoMedioKwh']),
    concessionaria: stringFromMetadata(metadata, ['concessionaria'], 'Não informada'),
    offer: stringFromMetadata(metadata, ['offer', 'ofertaEnervita', 'oferta'], 'Enervita Solar'),
    projectedSavings: numberFromMetadata(metadata, ['projectedSavings', 'economiaMensalProjetada']),
    priority: priority(raw.priority),
    contact: {
      id: contact.id ?? raw.contactId,
      name: contact.name ?? 'Lead sem nome',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      source: contact.source ?? raw.leadSource ?? '',
      consent: Boolean(contact.consent),
      createdAt: contact.createdAt ?? raw.createdAt,
      metadata: contact.metadata ?? undefined,
    },
  };
}

function mapProposal(raw: BackendProposal): Proposal {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    leadId: raw.leadId,
    title: raw.title,
    status: raw.status,
    monthlyBillValue: numeric(raw.monthlyBillValue),
    estimatedKwh: numeric(raw.estimatedKwh),
    discountPercentage: numeric(raw.discountPercentage),
    projectedMonthlySavings: numeric(raw.projectedMonthlySavings),
    projectedAnnualSavings: numeric(raw.projectedAnnualSavings),
    validUntil: raw.validUntil ?? undefined,
    sentAt: raw.sentAt ?? undefined,
    acceptedAt: raw.acceptedAt ?? undefined,
    lostAt: raw.lostAt ?? undefined,
    lostReason: raw.lostReason ?? undefined,
    notes: raw.notes ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    leadName: raw.leadName ?? undefined,
    leadStage: raw.leadStage ?? undefined,
  };
}

function mapTask(raw: BackendTask): Task {
  return {
    id: raw.id,
    leadId: raw.leadId ?? '',
    title: raw.title,
    status: raw.status === 'cancelado' ? 'atrasado' : raw.status,
    priority: priority(raw.priority),
    owner: raw.ownerName ?? raw.ownerId ?? 'Sem responsável',
    dueDate: raw.dueDate ?? raw.createdAt,
    notes: raw.notes ?? raw.description ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    leadName: raw.leadName ?? undefined,
  };
}

function mapActivity(raw: BackendActivity): Activity {
  return {
    id: raw.id,
    leadId: raw.leadId,
    contactId: raw.contactId ?? '',
    activityType: raw.activityType,
    outcome: raw.outcome ?? raw.notes ?? '',
    responseTimeSeconds: raw.responseTimeSeconds ?? undefined,
    notes: raw.notes ?? undefined,
    occurredAt: raw.occurredAt,
    createdAt: raw.createdAt,
  };
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error || `Erro HTTP ${response.status}`;
  } catch {
    return `Erro HTTP ${response.status}`;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export class HttpCrmApi implements CrmApi {
  async listLeads(): Promise<Lead[]> {
    const body = await requestJson<{ leads: BackendLead[] }>('/api/leads');
    return body.leads.map(mapLead);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, { credentials: 'include' });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(await parseError(response));
    const body = (await response.json()) as { lead: BackendLead };
    return mapLead(body.lead);
  }

  async updateLeadStage(id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string }): Promise<Lead> {
    const body = await requestJson<{ lead: BackendLead }>(`/api/leads/${encodeURIComponent(id)}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, notes: options?.notes, lostReason: options?.lostReason }),
    });
    return mapLead(body.lead);
  }

  async listProposals(): Promise<Proposal[]> {
    const body = await requestJson<{ proposals: BackendProposal[] }>('/api/proposals');
    return body.proposals.map(mapProposal);
  }

  async listProposalsForLead(leadId: string): Promise<Proposal[]> {
    const body = await requestJson<{ proposals: BackendProposal[] }>(`/api/leads/${encodeURIComponent(leadId)}/proposals`);
    return body.proposals.map(mapProposal);
  }

  async createProposal(payload: CreateProposalPayload): Promise<Proposal> {
    const body = await requestJson<{ proposal: BackendProposal }>('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapProposal(body.proposal);
  }

  async listTrackingEventsForLead(leadId: string): Promise<TrackingEvent[]> {
    const body = await requestJson<{ events: BackendTrackingEvent[] }>(`/api/leads/${encodeURIComponent(leadId)}/tracking-events`);
    return body.events;
  }

  async listTasks(): Promise<Task[]> {
    const body = await requestJson<{ tasks: BackendTask[] }>('/api/tasks');
    return body.tasks.map(mapTask);
  }

  async listTasksForLead(leadId: string): Promise<Task[]> {
    const body = await requestJson<{ tasks: BackendTask[] }>(`/api/leads/${encodeURIComponent(leadId)}/tasks`);
    return body.tasks.map(mapTask);
  }

  async createTask(payload: Partial<Task>): Promise<Task> {
    const body = await requestJson<{ task: BackendTask }>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: payload.leadId || undefined,
        title: payload.title,
        priority: payload.priority,
        dueDate: payload.dueDate,
        notes: payload.notes,
      }),
    });
    return mapTask(body.task);
  }

  async completeTask(id: string): Promise<Task> {
    const body = await requestJson<{ task: BackendTask }>(`/api/tasks/${encodeURIComponent(id)}/complete`, {
      method: 'PATCH',
    });
    return mapTask(body.task);
  }

  async listActivities(leadId: string): Promise<Activity[]> {
    const body = await requestJson<{ activities: BackendActivity[] }>(`/api/leads/${encodeURIComponent(leadId)}/activities`);
    return body.activities.map(mapActivity);
  }

  async createActivity(payload: Partial<Activity>): Promise<Activity> {
    if (!payload.leadId) throw new Error('leadId é obrigatório para registrar atividade');
    const body = await requestJson<{ activity: BackendActivity }>(`/api/leads/${encodeURIComponent(payload.leadId)}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: payload.activityType ?? 'note',
        outcome: payload.outcome ?? payload.notes ?? '',
        notes: payload.notes,
      }),
    });
    return mapActivity(body.activity);
  }

  async listDashboardMetrics(): Promise<DashboardMetrics> {
    const body = await requestJson<{ metrics: DashboardMetrics }>('/api/dashboard');
    return {
      ...body.metrics,
      recentEvents: body.metrics.recentEvents.map(mapActivity),
    };
  }

  async listAutomations(): Promise<AutomationRule[]> {
    const body = await requestJson<{ automations: AutomationRule[] }>('/api/automations');
    return body.automations;
  }

  async runAutomation(id: string, payload: Record<string, unknown> = {}): Promise<AutomationRun> {
    const body = await requestJson<{ run: AutomationRun }>(`/api/automations/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return body.run;
  }

  async listWebhooks(): Promise<Webhook[]> {
    const body = await requestJson<{ webhooks: Webhook[] }>('/api/webhooks');
    return body.webhooks;
  }

  async listWebhookDeliveries(): Promise<WebhookDelivery[]> {
    const body = await requestJson<{ deliveries: WebhookDelivery[] }>('/api/webhooks/deliveries');
    return body.deliveries;
  }

  async testWebhook(id: string): Promise<WebhookTestResult> {
    const body = await requestJson<{ result: WebhookTestResult }>(`/api/webhooks/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    });
    return body.result;
  }
}

export const api = new HttpCrmApi();
