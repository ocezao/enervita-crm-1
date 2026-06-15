import type { CrmApi } from './crmApi';
import type {
  Activity,
  AdsOverview,
  AdsSyncResult,
  AutomationRule,
  AutomationRun,
  CreateProposalPayload,
  CrmAnalyticsOverview,
  DashboardMetrics,
  FollowUpQueueItem,
  FollowUpRuleRunResult,
  FollowUpStatus,
  Lead,
  LeadHistoryEntry,
  N8nWorkflow,
  N8nWorkflowToggleResult,
  Notification,
  Proposal,
  TrackingEvent,
  Task,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
} from './types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class MockCrmApi implements CrmApi {
  private mockLeads: Lead[] = [];

  async listLeads(): Promise<Lead[]> {
    await delay(300);
    return this.mockLeads;
  }

  async getLead(): Promise<Lead | undefined> {
    return this.mockLeads[0];
  }
  async updateLead(): Promise<Lead> {
    return this.mockLeads[0];
  }
  async updateLeadStage(): Promise<Lead> {
    return this.mockLeads[0];
  }
  async setLeadTags(): Promise<Lead> {
    return this.mockLeads[0];
  }
  async bulkSetLeadTags(): Promise<Lead[]> {
    return this.mockLeads;
  }
  async deleteLead(): Promise<void> {}
  async bulkDeleteLeads(): Promise<number> {
    return 0;
  }

  async listProposals(): Promise<Proposal[]> {
    return [];
  }
  async listProposalsForLead(): Promise<Proposal[]> {
    return [];
  }
  async createProposal(payload: CreateProposalPayload): Promise<Proposal> {
    return { id: 'p-1', ...payload, tenantId: '', status: 'rascunho', leadId: payload.leadId ?? '', monthlyBillValue: payload.monthlyBillValue ?? 0, estimatedKwh: payload.estimatedKwh ?? 0, discountPercentage: payload.discountPercentage ?? 0, projectedMonthlySavings: payload.projectedMonthlySavings ?? 0, projectedAnnualSavings: payload.projectedAnnualSavings ?? 0, sourceType: payload.sourceType ?? 'editor', isTemplate: payload.isTemplate ?? false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as Proposal;
  }
  async listTemplates(): Promise<Proposal[]> {
    return [];
  }
  async getProposal(): Promise<Proposal> {
    return { id: 'p-1', tenantId: '', title: 'Mock', status: 'rascunho', leadId: '', monthlyBillValue: 0, estimatedKwh: 0, discountPercentage: 0, projectedMonthlySavings: 0, projectedAnnualSavings: 0, sourceType: 'editor', isTemplate: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as Proposal;
  }
  async updateProposal(): Promise<Proposal> {
    return { id: 'p-1', tenantId: '', title: 'Mock', status: 'rascunho', leadId: '', monthlyBillValue: 0, estimatedKwh: 0, discountPercentage: 0, projectedMonthlySavings: 0, projectedAnnualSavings: 0, sourceType: 'editor', isTemplate: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as Proposal;
  }
  async deleteProposal(): Promise<void> {}
  async listTrackingEventsForLead(): Promise<TrackingEvent[]> {
    return [];
  }

  async listTasks(): Promise<Task[]> {
    return [];
  }
  async listTasksForLead(): Promise<Task[]> {
    return [];
  }
  async createTask(): Promise<Task> {
    return {} as Task;
  }
  async completeTask(): Promise<Task> {
    return {} as Task;
  }

  async listActivities(): Promise<Activity[]> {
    return [];
  }
  async createActivity(): Promise<Activity> {
    return { id: 'a-1', leadId: 'l-1', activityType: 'note', outcome: 'ok', occurredAt: new Date().toISOString() } as Activity;
  }
  async listLeadHistory(): Promise<LeadHistoryEntry[]> {
    return [];
  }

  async listNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    return { notifications: [], unreadCount: 0 };
  }
  async markNotificationRead(): Promise<Notification> {
    return { id: 'n-1', tenantId: 't-1', userId: 'u-1', taskId: null, leadId: null, type: 'system', severity: 'info', title: 'mock', body: 'mock', href: null, metadata: {}, readAt: new Date().toISOString(), createdAt: new Date().toISOString() } as unknown as Notification;
  }
  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return { updated: 1 };
  }

  async listDashboardMetrics(): Promise<DashboardMetrics> {
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
      recentEvents: [],
    };
  }
  async listFollowUps(): Promise<FollowUpQueueItem[]> {
    return [{
      id: 'f-1',
      tenantId: 't-1',
      leadId: 'l-1',
      ruleKey: 'task_overdue',
      channel: 'manual',
      reason: 'Lead sem follow-up há 7 dias',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      sentAt: null,
      skippedAt: null,
      failedAt: null,
      attempts: 0,
      lastError: null,
      idempotencyKey: 'key-1',
      metadata: {},
      contactName: 'Mock Lead',
      contactPhone: '+5500000000000',
      contactEmail: 'mock@test.com',
      suggestedMessage: 'Olá, tudo bem?',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as FollowUpQueueItem];
  }
  async runFollowUpRules(): Promise<FollowUpRuleRunResult> {
    return { created: { task_overdue: 0, lead_without_next_action: 0, proposal_no_response: 0, opportunity_stale: 0 }, existing: { task_overdue: 0, lead_without_next_action: 0, proposal_no_response: 0, opportunity_stale: 0 } } as FollowUpRuleRunResult;
  }
  async skipFollowUp(id: string, reason?: string): Promise<FollowUpQueueItem> {
    return { id, leadId: 'l-1', ruleKey: 'task_overdue', status: 'skipped', priority: 'medium', attempts: 1, reason: reason ?? '', ruleSnapshot: {}, createdAt: new Date().toISOString() } as unknown as FollowUpQueueItem;
  }
  async markFollowUpSent(id: string): Promise<FollowUpQueueItem> {
    return { id, leadId: 'l-1', ruleKey: 'task_overdue', status: 'sent', priority: 'medium', attempts: 1, sentAt: new Date().toISOString(), ruleSnapshot: {}, createdAt: new Date().toISOString() } as unknown as FollowUpQueueItem;
  }
  async markFollowUpFailed(id: string, error: string): Promise<FollowUpQueueItem> {
    return { id, leadId: 'l-1', ruleKey: 'task_overdue', status: 'failed', priority: 'medium', attempts: 1, lastError: error, ruleSnapshot: {}, createdAt: new Date().toISOString() } as unknown as FollowUpQueueItem;
  }

  async getInsights(days: number = 30): Promise<{
    generatedAt: string;
    period: string;
    insights: Array<{
      id: string;
      type: 'pattern' | 'recommendation' | 'alert' | 'opportunity';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      metric?: string;
      trend?: 'up' | 'down' | 'stable';
      comparison?: string;
      action?: string;
      category: 'conversion' | 'source' | 'timing' | 'pipeline';
    }>;
    summary: {
      totalLeads: number;
      conversionRate: number;
      avgTimeToConvert: number;
      topSource: string;
      bottleneck: string;
    };
  }> {
    return {
      generatedAt: new Date().toISOString(),
      period: `${days}d`,
      insights: [],
      summary: {
        totalLeads: 0,
        conversionRate: 0,
        avgTimeToConvert: 0,
        topSource: 'Mock',
        bottleneck: 'Ambiente de mock sem dados históricos',
      },
    };
  }

  async getAnalyticsOverview(): Promise<CrmAnalyticsOverview> {
    return {
      generatedAt: new Date().toISOString(),
      filters: { days: 30, startDate: '', endDate: '' },
      kpis: [],
      daily: [],
      funnel: [],
      trafficSources: [],
      campaigns: [],
      signals: [],
      trackingStatus: [],
      eventNames: [],
      recentLeads: [],
      notes: [],
    } as unknown as CrmAnalyticsOverview;
  }

  async listAutomations(): Promise<AutomationRule[]> {
    return [];
  }
  async runAutomation(): Promise<AutomationRun> {
    return { id: 'run-1', automationId: 'a-1', status: 'completed', inputPayload: {}, results: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() } as unknown as AutomationRun;
  }
  async listN8nWorkflows(): Promise<N8nWorkflow[]> {
    return [];
  }
  async setN8nWorkflowActive(): Promise<N8nWorkflowToggleResult> {
    return { workflow: { id: 'w-1', name: 'Mock', active: true } } as unknown as N8nWorkflowToggleResult;
  }

  async listWebhooks(): Promise<Webhook[]> {
    return [];
  }
  async listWebhookDeliveries(): Promise<WebhookDelivery[]> {
    return [];
  }
  async testWebhook(): Promise<WebhookTestResult> {
    return { delivery: { id: 'd-1', status: 'success', statusCode: 200, responseBody: '', deliveredAt: new Date().toISOString(), createdAt: new Date().toISOString() } } as unknown as WebhookTestResult;
  }

  async getAdsOverview(): Promise<AdsOverview> {
    return {
      accounts: [],
      campaigns: [],
      detectedCampaigns: [],
      summary: { importedThisMonth: 0, totalActive: 0 },
      credentialRequirements: [],
    } as unknown as AdsOverview;
  }
  async syncMetaAds(): Promise<{ result: AdsSyncResult; overview: AdsOverview }> {
    const overview = await this.getAdsOverview();
    return { result: { totalImported: randomBetween(0, 20), totalUpdated: 0, totalErrors: 0, durationMs: 0, imported: [], updated: [], errors: [] } as unknown as AdsSyncResult, overview };
  }
}

export const api = new MockCrmApi();
