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

export interface LeadOpportunity {
  id: string;
  leadId: string;
  title: string;
  status: 'open' | 'won' | 'lost';
  expectedValue: string | null;
  probability: number;
  convertedBy: string | null;
  convertedAt: string;
  acceptedProposalId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadAttribution {
  id: string;
  sourceSystem: string;
  sourceChannel: string;
  leadgenId: string | null;
  formId: string | null;
  formName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  confidence: string;
  metadata: Record<string, unknown>;
  lastReconciledAt: string;
}

export interface Lead {
  id: string;
  contactId: string;
  clientId?: string;
  stage: LeadStage;
  pipelineKey?: string;
  pipelineStageKey?: string;
  pipelineStageLabel?: string | null;
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
  sdrOwner: string | null;
  sdrOwnerId?: string | null;
  firstResponseAt?: string;
  lastContactAt?: string;
  nextActionAt: string | null;
  notes?: string;
  submittedAt?: string; // Real form submission date (Meta created_time, site createdAt, etc.)
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
  opportunity?: LeadOpportunity | null;
  attribution?: LeadAttribution | null;
}

export interface PipelineStageDefinition {
  key: string;
  label: string;
  legacyStage: LeadStage;
  sortOrder: number;
  isTerminal: boolean;
}

export interface LeadPipeline {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  stages: PipelineStageDefinition[];
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

export interface Notification {
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
}

export interface LeadHistoryChange {
  field: string;
  label: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export type FollowUpStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'cancelled';
export type FollowUpChannel = 'manual' | 'whatsapp' | 'email';
export type FollowUpRuleKey = 'task_overdue' | 'lead_without_next_action' | 'proposal_no_response' | 'opportunity_stale';

export interface FollowUpQueueItem {
  id: string;
  tenantId: string;
  leadId: string;
  ruleKey: FollowUpRuleKey | string;
  channel: FollowUpChannel;
  reason: string;
  status: FollowUpStatus;
  scheduledAt: string;
  sentAt: string | null;
  skippedAt: string | null;
  failedAt: string | null;
  attempts: number;
  lastError: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  suggestedMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpRuleRunResult {
  created: Record<FollowUpRuleKey, number>;
  existing: Record<FollowUpRuleKey, number>;
}

export interface LeadHistoryEntry {
  id: string;
  action: string;
  occurredAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
  summary: string;
  changes: LeadHistoryChange[];
}

export interface TrackingEvent {
  id: string;
  leadId: string;
  platform: 'site' | 'meta' | 'ga4' | 'google_ads';
  eventName: string;
  status: 'queued' | 'sent' | 'failed' | 'discarded';
  sentAt?: string;
  attempts: number;
  nextRetryAt?: string;
  errorMessage?: string;
  payload: Record<string, unknown>;
}

export interface LeadDocument {
  id: string;
  tenantId: string;
  leadId: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  previewUrl: string;
  downloadUrl: string;
  storageBackend: 'postgres' | 'legacy_url' | 'external_url';
  checksumSha256: string | null;
  isPublic: boolean;
  uploadedByUserId: string | null;
  uploadedByUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
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
  sourceType: 'editor' | 'file';
  contentHtml?: string;
  contentText?: string;
  templateName?: string;
  isTemplate: boolean;
  importedFileName?: string;
  importedFileMimeType?: string;
  importedFileSize?: number;
  importedFileDataBase64?: string;
  createdAt: string;
  updatedAt: string;
  leadName?: string;
  leadStage?: LeadStage;
  solarSummary?: ProposalSolarSummary | null;
}

export interface ProposalSolarSummary {
  dimensionamentoId: string;
  quantidadeSugerida: number | null;
  potenciaTotalKwp: number | null;
  inversorSugeridoNome: string | null;
  cidade: string | null;
  uf: string | null;
  tipoTelhado: string | null;
}

export interface SolarIrradiacaoCidade {
  id: string;
  cidade: string;
  uf: string;
  codigo_ibge?: string | null;
  lat?: number | null;
  lon?: number | null;
  classe?: string | null;
  estado_nome?: string | null;
  fonte_id?: string | null;
  irradiacao_kwh_m2_dia: number;
  fonte?: string | null;
}

export interface SolarModeloPlaca {
  id: string;
  nome: string;
  fabricante?: string | null;
  potencia_wp: number;
  area_util_m2: number;
  eficiencia_decimal: number;
  padrao: boolean;
}

export interface SolarModeloInversor {
  id: string;
  nome: string;
  fabricante?: string | null;
  capacidade_kw: number;
  sobrecarga_decimal: number;
  padrao: boolean;
}

export interface SolarTipoTelhado {
  id: string;
  nome: string;
  perda_padrao_decimal: number;
}

export interface SolarDimensionamento {
  id: string;
  lead_id: string | null;
  proposal_id: string | null;
  cidade: string;
  uf: string;
  consumo_medio_mensal_kwh: number;
  tipo_telhado: string | null;
  perda_decimal: number;
  sobra_decimal: number;
  modelo_placa_nome: string;
  modelo_placa_potencia_wp: number;
  modelo_inversor_nome: string | null;
  irradiacao_kwh_m2_dia: number;
  producao_mensal_real_placa: number | null;
  consumo_com_sobra_kwh: number | null;
  quantidade_bruta_placas: number | null;
  quantidade_sugerida: number | null;
  potencia_total_sugerida_kwp: number | null;
  inversor_capacidade_real_kw: number | null;
  inversor_sobra_percentual: number | null;
  status: string;
  mensagens_erro: string[];
  mensagens_alerta: string[];
  created_at: string;
}

export interface SolarDimensionamentoPayload {
  lead_id?: string | null;
  proposal_id?: string | null;
  cidade: string;
  uf: string;
  consumo_medio_mensal_kwh: number;
  tipo_telhado?: string | null;
  perda_decimal?: number;
  sobra_decimal?: number;
  margem_inversor_decimal?: number;
  modelo_placa_id: string;
  dias_mes?: number;
}

export interface SolarLinhaCusto {
  custo_padrao_id?: string | null;
  nome: string;
  tipo: string;
  valor_calculado: number;
  quantidade_modulos?: number | null;
  distancia_km?: number | null;
  percentual?: number | null;
  origem?: string;
}

export interface SolarCustosCalculados {
  linhas: SolarLinhaCusto[];
  subtotal_nao_percentual: number;
  soma_percentuais: number;
  total_final: number;
  total_geral: number;
  quantidade_modulos: number;
}

export type ProposalImportedFilePayload = {
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
};

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
  sourceType: 'editor' | 'file';
  contentHtml?: string;
  contentText?: string;
  templateName?: string;
  isTemplate?: boolean;
  importedFile?: ProposalImportedFilePayload;
  status?: Proposal['status'];
};

export type UpdateProposalPayload = Omit<Partial<CreateProposalPayload>, 'importedFile' | 'leadId'> & {
  importedFile?: ProposalImportedFilePayload | null;
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
  status: 'queued' | 'sent' | 'failed' | 'discarded';
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

export interface CommercialStageBreakdown {
  stage: LeadStage;
  count: number;
  value: number;
}

export interface CommercialAttentionLead {
  id: string;
  name: string;
  stage: LeadStage;
  reason: string;
  updatedAt: string;
  nextActionAt?: string | null;
}

export interface CommercialMetrics {
  openOpportunityValue: number;
  wonOpportunityValue: number;
  openOpportunities: number;
  wonOpportunities: number;
  openProposals: number;
  acceptedProposals: number;
  acceptedProposalAnnualValue: number;
  overdueTasks: number;
  leadsWithoutNextAction: number;
  staleLeads: number;
  stageBreakdown: CommercialStageBreakdown[];
  attentionLeads: CommercialAttentionLead[];
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
  commercial?: CommercialMetrics;
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
  discarded: number;
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
