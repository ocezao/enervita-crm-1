import { CrmApi, type UpdateLeadPayload } from './crmApi';
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
  AdsOverview,
  AdsSyncResult,
  LeadStage,
  CrmAnalyticsOverview,
  LeadHistoryEntry,
  Notification
} from './types';
import {
  mockLeads,
  mockTasks,
  mockActivities,
  mockAutomations,
  mockWebhooks
} from '../../data/mockData';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class MockCrmApi implements CrmApi {
  async listLeads(): Promise<Lead[]> {
    await delay(500);
    return [...mockLeads];
  }

  async getLead(id: string): Promise<Lead | undefined> {
    await delay(300);
    return mockLeads.find(l => l.id === id);
  }


  async updateLead(id: string, payload: UpdateLeadPayload): Promise<Lead> {
    await delay(200);
    const lead = mockLeads.find(l => l.id === id);
    if (!lead) throw new Error('Lead not found');
    if (payload.contact) {
      lead.contact = {
        ...(lead.contact ?? { id: lead.contactId, name: '', email: '', phone: '', company: '', source: '', consent: true, createdAt: lead.createdAt }),
        name: payload.contact.name ?? lead.contact?.name ?? '',
        email: payload.contact.email ?? lead.contact?.email ?? '',
        phone: payload.contact.phone ?? lead.contact?.phone ?? '',
        company: payload.contact.company ?? lead.contact?.company ?? '',
        source: payload.contact.source ?? lead.contact?.source ?? '',
        consent: payload.contact.consent ?? lead.contact?.consent ?? true,
        metadata: payload.contact.metadata ?? lead.contact?.metadata,
      };
    }
    if (payload.leadSource !== undefined) lead.leadSource = payload.leadSource ?? '';
    if (payload.qualificationStatus !== undefined) lead.qualificationStatus = payload.qualificationStatus ?? 'aguardando';
    if (payload.priority !== undefined) lead.priority = payload.priority;
    if (payload.notes !== undefined) lead.notes = payload.notes ?? undefined;
    if (payload.estimatedTicket !== undefined) lead.estimatedTicket = payload.estimatedTicket ?? 0;
    if (payload.metadata !== undefined) {
      lead.metadata = payload.metadata;
      lead.energyBillValue = Number(payload.metadata.energyBillValue ?? lead.energyBillValue ?? 0);
      lead.averageConsumptionKwh = Number(payload.metadata.averageConsumptionKwh ?? lead.averageConsumptionKwh ?? 0);
      lead.concessionaria = String(payload.metadata.concessionaria ?? lead.concessionaria ?? '');
      lead.offer = String(payload.metadata.offer ?? lead.offer ?? '');
      lead.projectedSavings = Number(payload.metadata.projectedSavings ?? lead.projectedSavings ?? 0);
    }
    lead.updatedAt = new Date().toISOString();
    return { ...lead, contact: lead.contact ? { ...lead.contact } : undefined, metadata: { ...(lead.metadata ?? {}) } };
  }

  async updateLeadStage(id: string, stage: LeadStage): Promise<Lead> {
    await delay(400);
    const lead = mockLeads.find(l => l.id === id);
    if (!lead) throw new Error('Lead not found');
    lead.stage = stage;
    lead.updatedAt = new Date().toISOString();
    return { ...lead };
  }


  async setLeadTags(id: string, tags: string[]): Promise<Lead> {
    await delay(150);
    const lead = mockLeads.find(l => l.id === id);
    if (!lead) throw new Error('Lead not found');
    lead.tags = tags.map((tag, index) => ({ id: `mock-tag-${index}`, name: tag, slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'), color: null }));
    lead.updatedAt = new Date().toISOString();
    return { ...lead, tags: [...lead.tags] };
  }

  async bulkSetLeadTags(leadIds: string[], tags: string[]): Promise<Lead[]> {
    await delay(200);
    const ids = new Set(leadIds);
    return mockLeads.filter((lead) => ids.has(lead.id)).map((lead) => {
      lead.tags = tags.map((tag, index) => ({ id: `mock-tag-${index}`, name: tag, slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'), color: null }));
      lead.updatedAt = new Date().toISOString();
      return { ...lead, tags: [...lead.tags] };
    });
  }

  async deleteLead(id: string): Promise<void> {
    await delay(150);
    const index = mockLeads.findIndex((lead) => lead.id === id);
    if (index === -1) throw new Error('Lead not found');
    mockLeads.splice(index, 1);
  }

  async bulkDeleteLeads(leadIds: string[]): Promise<number> {
    await delay(200);
    const ids = new Set(leadIds);
    let deleted = 0;
    for (let index = mockLeads.length - 1; index >= 0; index -= 1) {
      if (ids.has(mockLeads[index].id)) {
        mockLeads.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }

  async listProposals(): Promise<Proposal[]> {
    await delay(300);
    return mockLeads.slice(0, 2).map((lead, index) => ({
      id: `mock-proposal-${index + 1}`,
      leadId: lead.id,
      title: `Proposta ${lead.contact?.name || lead.id}`,
      status: index === 0 ? 'draft' : 'sent',
      monthlyBillValue: lead.energyBillValue || 2500,
      estimatedKwh: lead.averageConsumptionKwh || 1800,
      discountPercentage: 20,
      projectedMonthlySavings: lead.projectedSavings || 500,
      projectedAnnualSavings: (lead.projectedSavings || 500) * 12,
      sourceType: 'editor',
      isTemplate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadName: lead.contact?.name,
      leadStage: lead.stage,
    }));
  }

  async listTemplates(): Promise<Proposal[]> {
    const proposals = await this.listProposals();
    return proposals.filter((proposal) => proposal.isTemplate);
  }

  async getProposal(id: string): Promise<Proposal> {
    const proposals = await this.listProposals();
    const proposal = proposals.find((item) => item.id === id);
    if (!proposal) throw new Error('Proposal not found');
    return proposal;
  }

  async updateProposal(id: string, payload: Partial<CreateProposalPayload>): Promise<Proposal> {
    const proposal = await this.getProposal(id);
    return { ...proposal, ...payload, updatedAt: new Date().toISOString() };
  }

  async deleteProposal(_id: string): Promise<void> {
    await delay(150);
  }

  async listProposalsForLead(leadId: string): Promise<Proposal[]> {
    const proposals = await this.listProposals();
    return proposals.filter((proposal) => proposal.leadId === leadId);
  }

  async createProposal(payload: CreateProposalPayload): Promise<Proposal> {
    await delay(300);
    const lead = mockLeads.find((item) => item.id === payload.leadId);
    return {
      id: Math.random().toString(36).substr(2, 9),
      ...payload,
      sourceType: payload.sourceType ?? 'editor',
      isTemplate: payload.isTemplate ?? false,
      estimatedKwh: payload.estimatedKwh || 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadName: lead?.contact?.name,
      leadStage: lead?.stage,
    };
  }

  async listTrackingEventsForLead(leadId: string): Promise<TrackingEvent[]> {
    await delay(200);
    return [
      { id: 'mock-event-meta', leadId, platform: 'meta', eventName: 'Lead', status: 'sent', attempts: 1, payload: { source: 'mock' } },
      { id: 'mock-event-site', leadId, platform: 'site', eventName: 'lead.created', status: 'sent', attempts: 1, payload: { source: 'mock' } },
    ];
  }

  async listTasks(): Promise<Task[]> {
    await delay(400);
    return [...mockTasks];
  }

  async listTasksForLead(leadId: string): Promise<Task[]> {
    await delay(150);
    return mockTasks.filter((task) => task.leadId === leadId);
  }

  async createTask(payload: Partial<Task>): Promise<Task> {
    await delay(300);
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      leadId: payload.leadId || '',
      title: payload.title || 'Nova Tarefa',
      status: 'pendente',
      priority: payload.priority || 'media',
      owner: payload.owner || 'Usuário',
      dueDate: payload.dueDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadName: payload.leadName
    };
    mockTasks.push(newTask);
    return newTask;
  }

  async completeTask(id: string): Promise<Task> {
    await delay(300);
    const task = mockTasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found');
    task.status = 'concluido';
    task.updatedAt = new Date().toISOString();
    return { ...task };
  }

  async listActivities(leadId: string): Promise<Activity[]> {
    await delay(300);
    return mockActivities.filter(a => a.leadId === leadId);
  }

  async createActivity(payload: Partial<Activity>): Promise<Activity> {
    await delay(300);
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      leadId: payload.leadId || '',
      contactId: payload.contactId || '',
      activityType: payload.activityType || 'note',
      outcome: payload.outcome || '',
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      notes: payload.notes
    };
    mockActivities.push(newActivity);
    return newActivity;
  }

  async listLeadHistory(leadId: string): Promise<LeadHistoryEntry[]> {
    await delay(150);
    const lead = mockLeads.find((item) => item.id === leadId);
    if (!lead) return [];
    return [
      {
        id: `mock-history-${leadId}`,
        action: 'lead.created',
        occurredAt: lead.createdAt,
        actor: { id: 'mock-system', name: 'Sistema Enervita', email: 'sistema@enervita.local' },
        summary: `Lead criado via ${lead.leadSource || 'origem não informada'}`,
        changes: [],
      },
    ];
  }

  async listNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    await delay(150);
    return { notifications: [], unreadCount: 0 };
  }

  async markNotificationRead(id: string): Promise<Notification> {
    await delay(150);
    return { id, tenantId: 'mock-tenant', userId: 'mock-user', taskId: null, leadId: null, type: 'task_assigned', severity: 'info', title: 'Notificação lida', body: '', href: '', metadata: {}, readAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  }

  async markAllNotificationsRead(): Promise<number> {
    await delay(150);
    return 0;
  }

  async listDashboardMetrics(): Promise<DashboardMetrics> {
    await delay(600);
    return {
      newLeadsToday: 3,
      leadsWithoutFollowup: 2,
      overdueTasks: 1,
      openProposals: 4,
      leadsBySource: [
        { source: 'Meta Ads', count: 12 },
        { source: 'Google Ads', count: 8 },
        { source: 'Indicação', count: 5 },
        { source: 'Orgânico', count: 7 },
      ],
      leadsByStage: [
        { stage: 'novo_lead', count: 10 },
        { stage: 'qualificacao', count: 5 },
        { stage: 'atendimento_iniciado', count: 8 },
        { stage: 'proposta_enviada', count: 4 },
        { stage: 'contrato_enervita', count: 2 },
      ],
      conversionsByPlatform: [
        { platform: 'Meta CAPI', count: 45 },
        { platform: 'GA4', count: 32 },
        { platform: 'Google Ads', count: 18 },
      ],
      recentEvents: mockActivities.slice(0, 5)
    };
  }


  async getAnalyticsOverview(filters: { days?: number; period?: string; startDate?: string; endDate?: string; source?: string; campaign?: string; stage?: LeadStage } = {}): Promise<CrmAnalyticsOverview> {
    await delay(250);
    const days = filters.days ?? 30;
    const defaultStart = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startDate = filters.startDate ?? defaultStart;
    const endDate = filters.endDate ?? new Date().toISOString().slice(0, 10);
    const since = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const scoped = mockLeads.filter((lead) => {
      if (new Date(lead.createdAt).getTime() < since || lead.createdAt.slice(0, 10) > endDate) return false;
      if (filters.stage && lead.stage !== filters.stage) return false;
      if (filters.source && (lead.utmSource ?? lead.leadSource ?? '').toLowerCase() !== filters.source.toLowerCase()) return false;
      if (filters.campaign && (lead.utmCampaign ?? '').toLowerCase() !== filters.campaign.toLowerCase()) return false;
      return true;
    });
    const tracked = scoped.filter((lead) => lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.utmTerm).length;
    const won = scoped.filter((lead) => lead.stage === 'contrato_enervita').length;
    const bySource = new Map<string, typeof scoped>();
    for (const lead of scoped) {
      const key = lead.utmSource || lead.leadSource || 'desconhecido';
      bySource.set(key, [...(bySource.get(key) ?? []), lead]);
    }
    const stages: LeadStage[] = ['novo_lead', 'qualificacao', 'atendimento_iniciado', 'conta_recebida', 'diagnostico', 'proposta_enviada', 'contrato_enervita', 'perdido'];
    return {
      filters: { days, period: filters.period ?? `last_${days}_days`, startDate, endDate, source: filters.source, campaign: filters.campaign, stage: filters.stage },
      generatedAt: new Date().toISOString(),
      kpis: [
        { key: 'totalLeads', label: 'Leads capturados', value: scoped.length, displayValue: String(scoped.length), helper: 'Mock local usado só em desenvolvimento', tone: 'blue' },
        { key: 'trackedLeads', label: 'Leads com rastreio', value: tracked, displayValue: `${tracked} / ${scoped.length ? Math.round((tracked / scoped.length) * 100) : 0}%`, helper: 'UTMs preservadas no lead', tone: 'green' },
        { key: 'wonRate', label: 'Conversão contrato', value: scoped.length ? (won / scoped.length) * 100 : 0, displayValue: `${scoped.length ? Math.round((won / scoped.length) * 100) : 0}%`, helper: 'Leads em contrato', tone: 'green' },
        { key: 'estimatedPipeline', label: 'Pipeline estimado', value: scoped.reduce((sum, lead) => sum + lead.estimatedTicket, 0), displayValue: `R$ ${scoped.reduce((sum, lead) => sum + lead.estimatedTicket, 0).toLocaleString('pt-BR')}`, helper: 'Ticket estimado', tone: 'slate' },
      ],
      daily: Array.from({ length: Math.min(days, 14) }, (_, index) => ({ date: new Date(Date.now() - (Math.min(days, 14) - 1 - index) * 86400000).toISOString().slice(0, 10), leads: index % 3, trackedLeads: index % 2, proposals: index % 2, won: index % 5 === 0 ? 1 : 0, trackingEvents: index % 4 })),
      funnel: stages.map((stage) => ({ key: stage, label: stage.replace(/_/g, ' '), value: scoped.filter((lead) => lead.stage === stage).length, rateFromPrevious: null })),
      trafficSources: [...bySource.entries()].map(([source, leads]) => ({ source, label: source, leads: leads.length, trackedLeads: leads.filter((lead) => lead.utmSource || lead.utmCampaign).length, proposals: leads.filter((lead) => lead.stage === 'proposta_enviada').length, won: leads.filter((lead) => lead.stage === 'contrato_enervita').length, estimatedTicket: leads.reduce((sum, lead) => sum + lead.estimatedTicket, 0), conversionRate: leads.length ? Math.round((leads.filter((lead) => lead.stage === 'contrato_enervita').length / leads.length) * 1000) / 10 : 0 })),
      campaigns: scoped.map((lead) => ({ campaign: lead.utmCampaign || 'sem_campaign', source: lead.utmSource || lead.leadSource || 'desconhecido', medium: lead.utmMedium || 'sem_medium', leads: 1, trackedLeads: lead.utmSource || lead.utmCampaign ? 1 : 0, proposals: lead.stage === 'proposta_enviada' ? 1 : 0, won: lead.stage === 'contrato_enervita' ? 1 : 0, estimatedTicket: lead.estimatedTicket, conversionRate: lead.stage === 'contrato_enervita' ? 100 : 0 })),
      signals: [
        { key: 'utm_source', label: 'UTM source', count: scoped.filter((lead) => lead.utmSource).length, coverageRate: scoped.length ? Math.round((scoped.filter((lead) => lead.utmSource).length / scoped.length) * 1000) / 10 : 0 },
        { key: 'utm_campaign', label: 'UTM campaign', count: scoped.filter((lead) => lead.utmCampaign).length, coverageRate: scoped.length ? Math.round((scoped.filter((lead) => lead.utmCampaign).length / scoped.length) * 1000) / 10 : 0 },
      ],
      trackingStatus: [],
      eventNames: [],
      recentLeads: scoped.slice(0, 10).map((lead) => ({ id: lead.id, name: lead.contact?.name ?? lead.id, stage: lead.stage, source: lead.utmSource || lead.leadSource, campaign: lead.utmCampaign || 'sem campaign', signals: [lead.utmSource ? 'utm_source' : '', lead.utmCampaign ? 'utm_campaign' : ''].filter(Boolean), createdAt: lead.createdAt })),
      notes: ['MockCrmApi usado apenas quando o app não está conectado ao backend real.'],
    };
  }

  async listAutomations(): Promise<AutomationRule[]> {
    await delay(400);
    return [...mockAutomations];
  }

  async runAutomation(id: string): Promise<AutomationRun> {
    await delay(400);
    return {
      id: 'mock-run-1',
      automationId: id,
      status: 'success',
      inputPayload: { reason: 'mock' },
      outputPayload: { queuedWebhookDeliveries: 0, externalHttpCalled: false },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  async getAdsOverview(): Promise<AdsOverview> {
    await delay(200);
    const detectedCampaigns = mockLeads
      .filter((lead) => lead.utmCampaign || lead.utmSource)
      .map((lead) => ({
        platform: (lead.utmSource ?? '').toLowerCase().includes('google') ? 'google_ads' as const : (lead.utmSource ?? '').toLowerCase().includes('facebook') || (lead.utmSource ?? '').toLowerCase().includes('meta') || (lead.utmSource ?? '').toLowerCase().includes('instagram') ? 'meta' as const : 'unknown' as const,
        utmSource: lead.utmSource ?? null,
        utmCampaign: lead.utmCampaign ?? null,
        utmContent: lead.utmContent ?? null,
        leads: 1,
        firstLeadAt: lead.createdAt,
        lastLeadAt: lead.createdAt,
      }));

    return {
      accounts: [
        { id: 'mock-meta', platform: 'meta', accountName: 'Meta Ads - Enervita', externalAccountId: null, status: 'pending_credentials', credentialHint: 'Aguardando system user token, ad account id e pixel/dataset id', lastSyncAt: null, syncError: null, metadata: {} },
        { id: 'mock-google', platform: 'google_ads', accountName: 'Google Ads - Enervita', externalAccountId: null, status: 'pending_credentials', credentialHint: 'Aguardando customer id, developer token e OAuth/refresh token', lastSyncAt: null, syncError: null, metadata: {} },
      ],
      campaigns: [],
      detectedCampaigns,
      summary: { connectedAccounts: 0, pendingCredentialAccounts: 2, activeCampaigns: 0, activeAdSets: 0, activeAds: 0, detectedUtmCampaigns: detectedCampaigns.length },
      credentialRequirements: {
        meta: ['Business Manager autorizado', 'System User Token com ads_read/read_insights', 'Ad Account ID', 'Pixel/Dataset ID para cruzar eventos'],
        google_ads: ['Customer ID da conta', 'Developer token', 'OAuth client/refresh token', 'MCC/conta autorizada para leitura'],
      },
    };
  }


  async syncMetaAds(): Promise<{ result: AdsSyncResult; overview: AdsOverview }> {
    const overview = await this.getAdsOverview();
    return { result: { platform: "meta", accountId: "act_mock", pixelId: "872374598469267", pixelName: "Enervita - Site", campaigns: overview.campaigns.length, adSets: 0, ads: 0, customAudiences: 0, syncedAt: new Date().toISOString() }, overview };
  }
  async listN8nWorkflows() {
    return [{
      id: 'env-crm-preview-webhook-homologacao',
      name: 'Enervita | CRM Custom Webhooks',
      description: 'Recebe eventos do CRM custom e confirma a integração com os fluxos comerciais.',
      active: true,
      status: 'active' as const,
      triggerSummary: 'Webhook',
      nodeSummary: ['Webhook', 'Resposta webhook'],
      webhookPaths: ['POST /webhook/lead-created'],
    }];
  }

  async setN8nWorkflowActive(id: string, active: boolean) {
    const workflow = (await this.listN8nWorkflows())[0];
    return { workflow: { ...workflow, id, active, status: active ? 'active' as const : 'paused' as const }, message: active ? 'Workflow despausado no modo mock.' : 'Workflow pausado no modo mock.' };
  }

  async listWebhooks(): Promise<Webhook[]> {
    await delay(400);
    return [...mockWebhooks];
  }

  async listWebhookDeliveries(): Promise<WebhookDelivery[]> {
    await delay(200);
    return [];
  }

  async testWebhook(id: string): Promise<WebhookTestResult> {
    await delay(1000);
    return {
      success: true,
      message: 'Validação registrada na fila com segurança.',
      delivery: {
        id: 'mock-delivery-1',
        webhookId: id,
        eventType: 'webhook.test',
        status: 'queued',
        httpStatus: null,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
    };
  }
}

export const api = new MockCrmApi();
