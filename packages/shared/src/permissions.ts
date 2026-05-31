export const PERMISSION_CATEGORIES = {
  navigation: 'Navegação',
  lead: 'Leads',
  task: 'Tarefas',
  activity: 'Atividades',
  data: 'Dados e relatórios',
  automation: 'Automações',
  ads: 'Mídia paga',
  webhook: 'Webhooks',
  proposal: 'Propostas',
  settings: 'Configurações',
  user: 'Usuários',
} as const;

export type PermissionCategoryKey = keyof typeof PERMISSION_CATEGORIES;

export const PAGE_PERMISSION_KEYS = [
  'page.dashboard',
  'page.leads',
  'page.pipeline',
  'page.lead_detail',
  'page.tasks',
  'page.proposals',
  'page.automations',
  'page.webhooks',
  'page.analytics',
  'page.ads',
  'page.settings',
  'page.users',
] as const;

export const ACTION_PERMISSION_KEYS = [
  'lead.view',
  'lead.create',
  'lead.edit',
  'lead.archive',
  'lead.stage_change',
  'lead.mark_lost',
  'task.create',
  'task.complete',
  'task.reschedule',
  'activity.create',
  'proposal.view',
  'proposal.create',
  'proposal.edit',
  'proposal.send',
  'proposal.accept',
  'csv.export',
  'tracking.view',
  'analytics.view',
  'ads.view',
  'ads.manage',
  'automation.manage',
  'webhook.test',
  'webhook.manage',
  'settings.manage',
  'user.manage',
] as const;

export const PERMISSION_KEYS = [...PAGE_PERMISSION_KEYS, ...ACTION_PERMISSION_KEYS] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSION_KEYS)[number];
export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionKind = 'page' | 'action';

export interface PermissionDefinition {
  readonly key: PermissionKey;
  readonly label: string;
  readonly category: PermissionCategoryKey;
  readonly group: string;
  readonly kind: PermissionKind;
  readonly description?: string;
}

export const PERMISSION_DEFINITIONS = [
  { key: 'page.dashboard', label: 'Acessar dashboard', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.leads', label: 'Acessar leads', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.pipeline', label: 'Acessar funil', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.lead_detail', label: 'Acessar detalhe do lead', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.tasks', label: 'Acessar tarefas', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.proposals', label: 'Acessar propostas', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.automations', label: 'Acessar automações', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.webhooks', label: 'Acessar webhooks', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.analytics', label: 'Acessar analytics', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.ads', label: 'Acessar mídia paga', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.settings', label: 'Acessar configurações', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'page.users', label: 'Acessar usuários', category: 'navigation', group: 'Páginas', kind: 'page' },
  { key: 'lead.view', label: 'Visualizar leads', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'lead.create', label: 'Criar leads', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'lead.edit', label: 'Editar leads', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'lead.archive', label: 'Arquivar leads', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'lead.stage_change', label: 'Mover etapa do lead', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'lead.mark_lost', label: 'Marcar lead como perdido', category: 'lead', group: 'Leads', kind: 'action' },
  { key: 'task.create', label: 'Criar tarefas', category: 'task', group: 'Tarefas', kind: 'action' },
  { key: 'task.complete', label: 'Concluir tarefas', category: 'task', group: 'Tarefas', kind: 'action' },
  { key: 'task.reschedule', label: 'Reagendar tarefas', category: 'task', group: 'Tarefas', kind: 'action' },
  { key: 'activity.create', label: 'Registrar atividades', category: 'activity', group: 'Atividades', kind: 'action' },
  { key: 'proposal.view', label: 'Visualizar propostas', category: 'proposal', group: 'Propostas', kind: 'action' },
  { key: 'proposal.create', label: 'Criar propostas', category: 'proposal', group: 'Propostas', kind: 'action' },
  { key: 'proposal.edit', label: 'Editar propostas', category: 'proposal', group: 'Propostas', kind: 'action' },
  { key: 'proposal.send', label: 'Enviar propostas', category: 'proposal', group: 'Propostas', kind: 'action' },
  { key: 'proposal.accept', label: 'Aceitar propostas', category: 'proposal', group: 'Propostas', kind: 'action' },
  { key: 'csv.export', label: 'Exportar CSV', category: 'data', group: 'Dados', kind: 'action' },
  { key: 'tracking.view', label: 'Visualizar rastreamento', category: 'data', group: 'Dados', kind: 'action' },
  { key: 'analytics.view', label: 'Visualizar analytics', category: 'data', group: 'Relatórios', kind: 'action' },
  { key: 'ads.view', label: 'Visualizar campanhas e anúncios', category: 'ads', group: 'Mídia paga', kind: 'action' },
  { key: 'ads.manage', label: 'Gerenciar credenciais de mídia', category: 'ads', group: 'Mídia paga', kind: 'action' },
  { key: 'automation.manage', label: 'Gerenciar automações', category: 'automation', group: 'Automações', kind: 'action' },
  { key: 'webhook.test', label: 'Testar webhooks', category: 'webhook', group: 'Webhooks', kind: 'action' },
  { key: 'webhook.manage', label: 'Gerenciar webhooks', category: 'webhook', group: 'Webhooks', kind: 'action' },
  { key: 'settings.manage', label: 'Gerenciar configurações', category: 'settings', group: 'Configurações', kind: 'action' },
  { key: 'user.manage', label: 'Gerenciar usuários', category: 'user', group: 'Usuários', kind: 'action' },
] as const satisfies readonly PermissionDefinition[];

export const PERMISSIONS_BY_KEY = Object.fromEntries(
  PERMISSION_DEFINITIONS.map((permission) => [permission.key, permission]),
) as Record<PermissionKey, PermissionDefinition>;

export const PIPELINE_STAGE_KEYS = [
  'novo_lead',
  'qualificacao',
  'atendimento_iniciado',
  'conta_recebida',
  'diagnostico',
  'proposta_enviada',
  'contrato_enervita',
  'perdido',
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGE_KEYS)[number];

export interface PipelineStageDefinition {
  readonly key: PipelineStageKey;
  readonly label: string;
  readonly description?: string;
  readonly order: number;
}

export const PIPELINE_STAGE_DEFINITIONS = [
  { key: 'novo_lead', label: 'Novo lead', order: 1 },
  { key: 'qualificacao', label: 'Qualificação', order: 2 },
  { key: 'atendimento_iniciado', label: 'Atendimento iniciado', order: 3 },
  { key: 'conta_recebida', label: 'Conta recebida', order: 4 },
  { key: 'diagnostico', label: 'Diagnóstico', order: 5 },
  { key: 'proposta_enviada', label: 'Proposta enviada', order: 6 },
  { key: 'contrato_enervita', label: 'Contrato Enervita', order: 7 },
  { key: 'perdido', label: 'Perdido', order: 8 },
] as const satisfies readonly PipelineStageDefinition[];

export const PIPELINE_STAGES_BY_KEY = Object.fromEntries(
  PIPELINE_STAGE_DEFINITIONS.map((stage) => [stage.key, stage]),
) as Record<PipelineStageKey, PipelineStageDefinition>;
