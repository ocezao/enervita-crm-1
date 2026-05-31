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

export interface LeadTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
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
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  gclid?: string;
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
  metadata?: Record<string, unknown>;
  contact?: Contact; // Join result
  tags: LeadTag[];
}

export interface Task {
  id: string;
  leadId: string;
  title: string;
  status: 'pendente' | 'concluido' | 'atrasado';
  priority: Priority;
  owner: string;
  ownerId?: string;
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


export type AdsPlatform = 'meta' | 'google_ads';

export interface AdsAccount {
  id: string;
  platform: AdsPlatform;
  accountName: string;
  externalAccountId: string | null;
  status: 'pending_credentials' | 'connected' | 'error' | 'disabled';
  credentialHint: string | null;
  lastSyncAt: string | null;
  syncError: string | null;
  metadata: Record<string, unknown>;
}

export interface AdCreative {
  id: string;
  externalAdId: string | null;
  name: string;
  effectiveStatus: string;
  creativeName: string | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  body: string | null;
  destinationUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface AdSet {
  id: string;
  externalAdSetId: string | null;
  name: string;
  effectiveStatus: string;
  budgetAmount: number | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  audienceSummary: string | null;
  metadata: Record<string, unknown>;
  ads: AdCreative[];
}

export interface AdCampaign {
  id: string;
  platform: AdsPlatform;
  externalCampaignId: string | null;
  name: string;
  objective: string | null;
  effectiveStatus: string;
  budgetAmount: number | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  buyingType: string | null;
  bidStrategy: string | null;
  budgetRemaining: number | null;
  metadata: Record<string, unknown>;
  adSets: AdSet[];
}

export interface DetectedCampaign {
  platform: AdsPlatform | 'unknown';
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  leads: number;
  firstLeadAt: string;
  lastLeadAt: string;
}

export interface AdsSyncResult {
  platform: "meta";
  accountId: string;
  pixelId: string;
  pixelName: string;
  campaigns: number;
  adSets: number;
  ads: number;
  customAudiences: number;
  syncedAt: string;
  skipped?: boolean;
  reason?: string;
}

export interface AdsOverview {
  accounts: AdsAccount[];
  campaigns: AdCampaign[];
  detectedCampaigns: DetectedCampaign[];
  summary: {
    connectedAccounts: number;
    pendingCredentialAccounts: number;
    activeCampaigns: number;
    activeAdSets: number;
    activeAds: number;
    detectedUtmCampaigns: number;
  };
  credentialRequirements: Record<AdsPlatform, string[]>;
}

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


export interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  status: 'active' | 'paused' | 'archived';
  triggerSummary: string;
  nodeSummary: string[];
  webhookPaths: string[];
  updatedAt?: string;
  versionId?: string | null;
  activeVersionId?: string | null;
}

export interface N8nWorkflowToggleResult {
  workflow: N8nWorkflow;
  message: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: 'queued' | 'success' | 'failed';
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
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

export interface WebhookDelivery {
  id: string;
  tenantId?: string;
  webhookId: string;
  webhookName?: string;
  eventType: string;
  status: 'queued' | 'sent' | 'failed';
  httpStatus: number | null;
  attempts: number;
  createdAt: string;
  deliveredAt?: string | null;
  responseBody?: string | null;
}

export interface WebhookTestResult {
  success: boolean;
  message: string;
  delivery: WebhookDelivery;
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


export interface AnalyticsKpi {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  helper: string;
  tone: 'green' | 'orange' | 'blue' | 'red' | 'slate';
}

export interface AnalyticsDailyPoint {
  date: string;
  leads: number;
  trackedLeads: number;
  proposals: number;
  won: number;
  trackingEvents: number;
}

export interface AnalyticsFunnelStep {
  key: LeadStage;
  label: string;
  value: number;
  rateFromPrevious: number | null;
}

export interface AnalyticsTrafficSource {
  source: string;
  label: string;
  leads: number;
  trackedLeads: number;
  proposals: number;
  won: number;
  estimatedTicket: number;
  conversionRate: number;
}

export interface AnalyticsCampaign {
  campaign: string;
  source: string;
  medium: string;
  leads: number;
  trackedLeads: number;
  proposals: number;
  won: number;
  estimatedTicket: number;
  conversionRate: number;
}

export interface AnalyticsSignal {
  key: string;
  label: string;
  count: number;
  coverageRate: number;
}

export interface AnalyticsTrackingStatus {
  platform: string;
  sent: number;
  queued: number;
  failed: number;
  total: number;
  lastSentAt: string | null;
}

export interface AnalyticsEventName {
  eventName: string;
  platform: string;
  count: number;
  lastSeenAt: string | null;
}

export interface AnalyticsRecentLead {
  id: string;
  name: string;
  stage: LeadStage;
  source: string;
  campaign: string;
  signals: string[];
  createdAt: string;
}

export interface CrmAnalyticsOverview {
  filters: { days: number; period?: string; startDate: string; endDate: string; source?: string; campaign?: string; stage?: LeadStage };
  generatedAt: string;
  kpis: AnalyticsKpi[];
  daily: AnalyticsDailyPoint[];
  funnel: AnalyticsFunnelStep[];
  trafficSources: AnalyticsTrafficSource[];
  campaigns: AnalyticsCampaign[];
  signals: AnalyticsSignal[];
  trackingStatus: AnalyticsTrackingStatus[];
  eventNames: AnalyticsEventName[];
  recentLeads: AnalyticsRecentLead[];
  notes: string[];
}
