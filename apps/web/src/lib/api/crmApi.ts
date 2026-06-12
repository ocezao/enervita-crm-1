import {
  Lead,
  Task,
  Activity,
  AutomationRule,
  AutomationRun,
  N8nWorkflow,
  N8nWorkflowToggleResult,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
  DashboardMetrics,
  Proposal,
  CreateProposalPayload,
  TrackingEvent,
  AdsOverview,
  AdsSyncResult,
  LeadStage,
  LeadTag,
  Priority,
  CrmAnalyticsOverview,
  LeadHistoryEntry,
  Notification,
} from './types';

export interface CrmApi {
  listLeads(filters?: { tags?: string[]; tagMode?: 'any' | 'all' }): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLead(id: string, payload: UpdateLeadPayload): Promise<Lead>;
  updateLeadStage(id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string; createOpportunity?: boolean }): Promise<Lead>;
  setLeadTags(id: string, tags: string[]): Promise<Lead>;
  bulkSetLeadTags(leadIds: string[], tags: string[]): Promise<Lead[]>;
  deleteLead(id: string): Promise<void>;
  bulkDeleteLeads(leadIds: string[]): Promise<number>;

  listProposals(): Promise<Proposal[]>;
  listProposalsForLead(leadId: string): Promise<Proposal[]>;
  createProposal(payload: CreateProposalPayload): Promise<Proposal>;
  listTemplates(): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal>;
  updateProposal(id: string, payload: Partial<CreateProposalPayload>): Promise<Proposal>;
  deleteProposal(id: string): Promise<void>;
  listTrackingEventsForLead(leadId: string): Promise<TrackingEvent[]>;

  listTasks(): Promise<Task[]>;
  listTasksForLead(leadId: string): Promise<Task[]>;
  createTask(payload: Partial<Task>): Promise<Task>;
  completeTask(id: string): Promise<Task>;

  listActivities(leadId: string): Promise<Activity[]>;
  createActivity(payload: Partial<Activity>): Promise<Activity>;
  listLeadHistory(leadId: string): Promise<LeadHistoryEntry[]>;
  listNotifications(limit?: number): Promise<{ notifications: Notification[]; unreadCount: number }>;
  markNotificationRead(id: string): Promise<Notification>;
  markAllNotificationsRead(): Promise<number>;

  listDashboardMetrics(): Promise<DashboardMetrics>;
  getAnalyticsOverview(filters?: { days?: number; period?: string; startDate?: string; endDate?: string; source?: string; campaign?: string; stage?: LeadStage }): Promise<CrmAnalyticsOverview>;

  listAutomations(): Promise<AutomationRule[]>;
  runAutomation(id: string, payload?: Record<string, unknown>): Promise<AutomationRun>;
  listN8nWorkflows(): Promise<N8nWorkflow[]>;
  setN8nWorkflowActive(id: string, active: boolean): Promise<N8nWorkflowToggleResult>;

  listWebhooks(): Promise<Webhook[]>;
  listWebhookDeliveries(): Promise<WebhookDelivery[]>;
  testWebhook(id: string): Promise<WebhookTestResult>;

  getAdsOverview(): Promise<AdsOverview>;
  syncMetaAds(): Promise<{ result: AdsSyncResult; overview: AdsOverview }>;
}

export type UpdateLeadPayload = {
  contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    source?: string | null;
    consent?: boolean;
    metadata?: Record<string, unknown>;
  };
  qualificationStatus?: string | null;
  leadSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  estimatedTicket?: number | null;
  priority?: Priority;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

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
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  estimatedTicket?: string | number | null;
  sdrOwnerId?: string | null;
  sdrOwner?: string | null;
  nextActionAt?: string | null;
  priority?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  contact?: BackendContact | null;
  tags?: LeadTag[] | null;
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
  sourceType?: Proposal['sourceType'] | null;
  contentHtml?: string | null;
  contentText?: string | null;
  templateName?: string | null;
  isTemplate?: boolean | null;
  importedFileName?: string | null;
  importedFileMimeType?: string | null;
  importedFileSize?: string | number | null;
  importedFileDataBase64?: string | null;
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

type BackendNotification = {
  id: string;
  tenantId: string;
  userId: string;
  taskId: string | null;
  leadId: string | null;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string | null;
  href: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
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

type BackendLeadHistoryEntry = LeadHistoryEntry;

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

function extractSubmittedAt(metadata: Record<string, unknown>, contactMetadata: Record<string, unknown>, createdAt: string, updatedAt: string): string {
  const meta = (metadata.meta as Record<string, unknown> | undefined) ?? {};
  const contactMeta = (contactMetadata.meta as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    meta?.createdTime,
    meta?.created_at,
    meta?.receivedAt,
    meta?.received_at,
    contactMeta?.createdTime,
    contactMeta?.created_at,
    contactMeta?.receivedAt,
    contactMeta?.received_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const time = new Date(candidate).getTime();
      if (Number.isFinite(time)) return candidate;
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return new Date(candidate * 1000).toISOString();
    }
  }
  return createdAt || updatedAt;
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
    fbp: raw.fbp ?? undefined,
    fbc: raw.fbc ?? undefined,
    fbclid: raw.fbclid ?? undefined,
    gclid: raw.gclid ?? undefined,
    estimatedTicket: numeric(raw.estimatedTicket),
    sdrOwner: raw.sdrOwner ?? raw.sdrOwnerId ?? 'Sem responsável',
    nextActionAt: raw.nextActionAt ?? null,
    notes: raw.notes ?? undefined,
    submittedAt: extractSubmittedAt(metadata, contact.metadata ?? {}, raw.createdAt, raw.updatedAt),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    energyBillValue: numberFromMetadata(metadata, ['energyBillValue', 'billValue', 'contaMediaMensal']),
    averageConsumptionKwh: numberFromMetadata(metadata, ['averageConsumptionKwh', 'consumoMedioKwh']),
    concessionaria: stringFromMetadata(metadata, ['concessionaria'], 'Não informada'),
    offer: stringFromMetadata(metadata, ['offer', 'ofertaEnervita', 'oferta'], 'Enervita Solar'),
    projectedSavings: numberFromMetadata(metadata, ['projectedSavings', 'economiaMensalProjetada']),
    priority: priority(raw.priority),
    metadata,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
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
    sourceType: raw.sourceType ?? 'editor',
    contentHtml: raw.contentHtml ?? undefined,
    contentText: raw.contentText ?? undefined,
    templateName: raw.templateName ?? undefined,
    isTemplate: raw.isTemplate === true,
    importedFileName: raw.importedFileName ?? undefined,
    importedFileMimeType: raw.importedFileMimeType ?? undefined,
    importedFileSize: raw.importedFileSize === null || raw.importedFileSize === undefined ? undefined : numeric(raw.importedFileSize),
    importedFileDataBase64: raw.importedFileDataBase64 ?? undefined,
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
    ownerId: raw.ownerId ?? undefined,
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

function mapNotification(notification: BackendNotification): Notification {
  return notification;
}

function mapLeadHistoryEntry(raw: BackendLeadHistoryEntry): LeadHistoryEntry {
  return {
    id: raw.id,
    action: raw.action,
    occurredAt: raw.occurredAt,
    actor: raw.actor ? {
      id: raw.actor.id,
      name: raw.actor.name,
      email: raw.actor.email,
    } : {
      id: 'system',
      name: 'Sistema',
      email: 'automático',
    },
    summary: raw.summary,
    changes: Array.isArray(raw.changes) ? raw.changes.map((change) => ({
      field: change.field,
      label: change.label,
      before: change.before ?? null,
      after: change.after ?? null,
    })) : [],
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
  async listLeads(filters?: { tags?: string[]; tagMode?: 'any' | 'all' }): Promise<Lead[]> {
    const params = new URLSearchParams();
    if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters?.tagMode && filters.tagMode !== 'any') params.set('tagMode', filters.tagMode);
    const query = params.toString();
    const body = await requestJson<{ leads: BackendLead[] }>(`/api/leads${query ? `?${query}` : ''}`);
    return body.leads.map(mapLead);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, { credentials: 'include' });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(await parseError(response));
    const body = (await response.json()) as { lead: BackendLead };
    return mapLead(body.lead);
  }

  async updateLead(id: string, payload: UpdateLeadPayload): Promise<Lead> {
    const body = await requestJson<{ lead: BackendLead }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapLead(body.lead);
  }

  async updateLeadStage(id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string; createOpportunity?: boolean }): Promise<Lead> {
    const body = await requestJson<{ lead: BackendLead }>(`/api/leads/${encodeURIComponent(id)}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, notes: options?.notes, lostReason: options?.lostReason, createOpportunity: options?.createOpportunity }),
    });
    return mapLead(body.lead);
  }

  async setLeadTags(id: string, tags: string[]): Promise<Lead> {
    const body = await requestJson<{ lead: BackendLead }>(`/api/leads/${encodeURIComponent(id)}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    return mapLead(body.lead);
  }

  async bulkSetLeadTags(leadIds: string[], tags: string[]): Promise<Lead[]> {
    const body = await requestJson<{ leads: BackendLead[] }>('/api/leads/bulk/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds, tags }),
    });
    return body.leads.map(mapLead);
  }

  async deleteLead(id: string): Promise<void> {
    await requestJson<{ deleted: number }>(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async bulkDeleteLeads(leadIds: string[]): Promise<number> {
    const body = await requestJson<{ deleted: number }>('/api/leads/bulk/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds }),
    });
    return body.deleted;
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

  async listTemplates(): Promise<Proposal[]> {
    const body = await requestJson<{ proposals: BackendProposal[] }>('/api/proposals/templates');
    return body.proposals.map(mapProposal);
  }

  async getProposal(id: string): Promise<Proposal> {
    const body = await requestJson<{ proposal: BackendProposal }>(`/api/proposals/${encodeURIComponent(id)}`);
    return mapProposal(body.proposal);
  }

  async updateProposal(id: string, payload: Partial<CreateProposalPayload>): Promise<Proposal> {
    const body = await requestJson<{ proposal: BackendProposal }>(`/api/proposals/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapProposal(body.proposal);
  }

  async deleteProposal(id: string): Promise<void> {
    await requestJson<{ deleted: boolean }>(`/api/proposals/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        description: payload.notes,
        ownerId: payload.ownerId,
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

  async listLeadHistory(leadId: string): Promise<LeadHistoryEntry[]> {
    const body = await requestJson<{ history: BackendLeadHistoryEntry[] }>(`/api/leads/${encodeURIComponent(leadId)}/history`);
    return body.history.map(mapLeadHistoryEntry);
  }

  async listNotifications(limit = 20): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const body = await requestJson<{ notifications: BackendNotification[]; unreadCount: number }>(`/api/notifications?limit=${encodeURIComponent(String(limit))}`);
    return { notifications: body.notifications.map(mapNotification), unreadCount: body.unreadCount };
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const body = await requestJson<{ notification: BackendNotification }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
    return mapNotification(body.notification);
  }

  async markAllNotificationsRead(): Promise<number> {
    const body = await requestJson<{ updated: number }>('/api/notifications/read-all', { method: 'POST' });
    return body.updated;
  }

  async listDashboardMetrics(): Promise<DashboardMetrics> {
    const body = await requestJson<{ metrics: DashboardMetrics }>('/api/dashboard');
    return {
      ...body.metrics,
      recentEvents: body.metrics.recentEvents.map(mapActivity),
    };
  }

  async getAnalyticsOverview(filters: { days?: number; period?: string; startDate?: string; endDate?: string; source?: string; campaign?: string; stage?: LeadStage } = {}): Promise<CrmAnalyticsOverview> {
    const params = new URLSearchParams();
    if (filters.days) params.set('days', String(filters.days));
    if (filters.period) params.set('period', filters.period);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.source) params.set('source', filters.source);
    if (filters.campaign) params.set('campaign', filters.campaign);
    if (filters.stage) params.set('stage', filters.stage);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const body = await requestJson<{ overview: CrmAnalyticsOverview }>(`/api/analytics/overview${suffix}`);
    return body.overview;
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

  async listN8nWorkflows(): Promise<N8nWorkflow[]> {
    const body = await requestJson<{ workflows: N8nWorkflow[] }>('/api/automations/n8n-workflows');
    return body.workflows;
  }

  async setN8nWorkflowActive(id: string, active: boolean): Promise<N8nWorkflowToggleResult> {
    const body = await requestJson<{ result: N8nWorkflowToggleResult }>(`/api/automations/n8n-workflows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    return body.result;
  }

  async getAdsOverview(): Promise<AdsOverview> {
    const body = await requestJson<{ overview: AdsOverview }>('/api/ads/overview');
    return body.overview;
  }

  async syncMetaAds(): Promise<{ result: AdsSyncResult; overview: AdsOverview }> {
    return await requestJson<{ result: AdsSyncResult; overview: AdsOverview }>("/api/ads/sync/meta", { method: "POST" });
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
