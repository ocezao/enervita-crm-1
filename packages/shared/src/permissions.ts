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
  'page.ai_assistant',
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
  { key: 'page.ai_assistant', label: 'Acessar Assistente IA', category: 'navigation', group: 'Páginas', kind: 'page' },
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
  // Usina Solar stages
  'elaboracao_proposta',
  'apresentacao_proposta',
  'negociacao_follow_up',
  'fechamento',
  'vistoria_estudo_tecnico',
  'assinatura_contrato',
  'ganho_contrato_assinado',
  'perdido_desqualificado',
  // Energia por Assinatura stages
  'novo_lead_energia',
  'novo_contato',
  'conta_luz',
  'elaboracao_proposta_energia',
  'apresentacao_proposta_energia',
  'analise_documentos',
  'elaboracao_contrato_adesao',
  'aguardando_assinatura',
  'ganho_contrato_assinado_energia',
  'perdido_energia',
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
  // Usina Solar stages
  { key: 'elaboracao_proposta', label: 'Elaboração de proposta', order: 9 },
  { key: 'apresentacao_proposta', label: 'Apresentação de proposta', order: 10 },
  { key: 'negociacao_follow_up', label: 'Negociação / Follow-up', order: 11 },
  { key: 'fechamento', label: 'Fechamento', order: 12 },
  { key: 'vistoria_estudo_tecnico', label: 'Vistoria / Estudo técnico', order: 13 },
  { key: 'assinatura_contrato', label: 'Assinatura de Contrato', order: 14 },
  { key: 'ganho_contrato_assinado', label: 'Ganho/ Contrato assinado', order: 15 },
  { key: 'perdido_desqualificado', label: 'Perdido / Desqualificado', order: 16 },
  // Energia por Assinatura stages
  { key: 'novo_lead_energia', label: 'Novo Lead', order: 17 },
  { key: 'novo_contato', label: 'Novo contato', order: 18 },
  { key: 'conta_luz', label: 'Conta de luz', order: 19 },
  { key: 'elaboracao_proposta_energia', label: 'Elaboração de proposta', order: 20 },
  { key: 'apresentacao_proposta_energia', label: 'Apresentação de proposta', order: 21 },
  { key: 'analise_documentos', label: 'Análise de documentos', order: 22 },
  { key: 'elaboracao_contrato_adesao', label: 'Elaboração de contrato e adesão', order: 23 },
  { key: 'aguardando_assinatura', label: 'Aguardando Assinatura do contrato', order: 24 },
  { key: 'ganho_contrato_assinado_energia', label: 'Ganho/Contrato assinado', order: 25 },
  { key: 'perdido_energia', label: 'Perdido', order: 26 },
] as const satisfies readonly PipelineStageDefinition[];

export const PIPELINE_STAGES_BY_KEY = Object.fromEntries(
  PIPELINE_STAGE_DEFINITIONS.map((stage) => [stage.key, stage]),
) as Record<PipelineStageKey, PipelineStageDefinition>;

// ============================================================
// ROLES & ROLE PROFILES
// ============================================================



export const ROLE_KEYS = [
  'admin',
  'gerente',
  'vendedor',
  'sdr',
  'consultor',
  'financeiro',
  'marketing',
  'operacional',
  'administrativo',
  'tecnico',
  'instalador',
  'supervisor',
  'pos_venda',
  'parceiro',
  'investidor',
] as const;

export type RoleKey = typeof ROLE_KEYS[number];

export interface RoleProfile {
  readonly key: RoleKey;
  readonly label: string;
  readonly description: string;
  readonly category: 'comercial' | 'apoio' | 'tecnico' | 'externo';
  readonly defaultPermissions: PermissionKey[];
  readonly defaultStages: PipelineStageKey[];
}

export const ROLE_PROFILES: Record<RoleKey, RoleProfile> = {
  admin: {
    key: 'admin',
    label: 'Admin',
    description: 'Acesso total, bypass de todas as verificacoes',
    category: 'comercial',
    defaultPermissions: [...PERMISSION_KEYS],
    defaultStages: [...PIPELINE_STAGE_KEYS],
  },
  gerente: {
    key: 'gerente',
    label: 'Gerente Comercial',
    description: 'Gestao comercial, pode retroceder leads',
    category: 'comercial',
    defaultPermissions: PERMISSION_KEYS.filter((p) => p !== 'user.manage'),
    defaultStages: [...PIPELINE_STAGE_KEYS],
  },
  vendedor: {
    key: 'vendedor',
    label: 'Vendedor',
    description: 'Vendas completas, propostas, follow-up',
    category: 'comercial',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.pipeline', 'page.lead_detail',
      'page.proposals', 'page.tasks',
      'lead.view', 'lead.create', 'lead.edit', 'lead.stage_change', 'lead.mark_lost',
      'proposal.view', 'proposal.create', 'proposal.edit', 'proposal.send',
      'task.create', 'task.complete', 'task.reschedule',
      'activity.create', 'tracking.view',
    ],
    defaultStages: ['novo_lead', 'qualificacao', 'atendimento_iniciado', 'conta_recebida', 'diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
  sdr: {
    key: 'sdr',
    label: 'SDR',
    description: 'Qualificacao e primeiro contato',
    category: 'comercial',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.pipeline', 'page.lead_detail', 'page.tasks',
      'lead.view', 'lead.create', 'lead.edit', 'lead.stage_change',
      'task.create', 'task.complete', 'task.reschedule',
      'activity.create',
    ],
    defaultStages: ['novo_lead', 'qualificacao', 'atendimento_iniciado'],
  },
  consultor: {
    key: 'consultor',
    label: 'Consultor Solar',
    description: 'Consultoria tecnica + comercial',
    category: 'comercial',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.pipeline', 'page.lead_detail',
      'page.proposals', 'page.tasks',
      'lead.view', 'lead.create', 'lead.edit', 'lead.stage_change', 'lead.mark_lost',
      'proposal.view', 'proposal.create', 'proposal.edit', 'proposal.send',
      'task.create', 'task.complete', 'task.reschedule',
      'activity.create',
    ],
    defaultStages: ['novo_lead', 'qualificacao', 'atendimento_iniciado', 'conta_recebida', 'diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
  financeiro: {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Propostas, contratos, relatorios',
    category: 'apoio',
    defaultPermissions: [
      'page.dashboard', 'page.proposals', 'page.analytics',
      'proposal.view', 'proposal.edit', 'proposal.accept',
      'analytics.view', 'csv.export',
    ],
    defaultStages: ['diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
  marketing: {
    key: 'marketing',
    label: 'Marketing',
    description: 'Leads (visualizacao), analytics, anuncios',
    category: 'apoio',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.analytics', 'page.ads',
      'lead.view', 'analytics.view', 'ads.view', 'ads.manage', 'tracking.view',
    ],
    defaultStages: ['novo_lead', 'qualificacao'],
  },
  operacional: {
    key: 'operacional',
    label: 'Operacional',
    description: 'Tarefas, atividades, apoio operacional',
    category: 'apoio',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.tasks',
      'lead.view', 'task.create', 'task.complete', 'task.reschedule', 'activity.create',
    ],
    defaultStages: ['atendimento_iniciado', 'conta_recebida', 'diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
  administrativo: {
    key: 'administrativo',
    label: 'Administrativo',
    description: 'Suporte administrativo geral',
    category: 'apoio',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.proposals', 'page.tasks',
      'lead.view', 'proposal.view', 'proposal.edit', 'task.create', 'task.complete',
    ],
    defaultStages: ['proposta_enviada', 'contrato_enervita'],
  },
  tecnico: {
    key: 'tecnico',
    label: 'Tecnico/Projetista',
    description: 'Diagnostico tecnico, projetos, pareceres',
    category: 'tecnico',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.pipeline', 'page.lead_detail', 'page.tasks',
      'lead.view', 'lead.edit', 'task.create', 'task.complete',
    ],
    defaultStages: ['conta_recebida', 'diagnostico', 'proposta_enviada'],
  },
  instalador: {
    key: 'instalador',
    label: 'Instalador',
    description: 'Execucao de instalacoes, checklist de campo',
    category: 'tecnico',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.tasks',
      'lead.view', 'task.create', 'task.complete', 'activity.create',
    ],
    defaultStages: ['proposta_enviada', 'contrato_enervita'],
  },
  supervisor: {
    key: 'supervisor',
    label: 'Supervisor de Obra',
    description: 'Acompanhamento de instalacoes em campo',
    category: 'tecnico',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.tasks',
      'lead.view', 'lead.edit', 'task.create', 'task.complete', 'task.reschedule', 'activity.create',
    ],
    defaultStages: ['diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
  pos_venda: {
    key: 'pos_venda',
    label: 'Pos-Venda',
    description: 'Suporte ao cliente pos-instalacao',
    category: 'tecnico',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.tasks',
      'lead.view', 'lead.edit', 'task.create', 'task.complete', 'activity.create',
    ],
    defaultStages: ['contrato_enervita'],
  },
  parceiro: {
    key: 'parceiro',
    label: 'Parceiro/Indicacao',
    description: 'Indicacoes e leads de parceiros',
    category: 'externo',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail',
      'lead.view', 'lead.create',
    ],
    defaultStages: ['novo_lead', 'qualificacao'],
  },
  investidor: {
    key: 'investidor',
    label: 'Investidor',
    description: 'Visualizacao de usinas e oportunidades',
    category: 'externo',
    defaultPermissions: [
      'page.dashboard', 'page.leads', 'page.lead_detail', 'page.proposals', 'page.analytics',
      'lead.view', 'proposal.view', 'analytics.view',
    ],
    defaultStages: ['diagnostico', 'proposta_enviada', 'contrato_enervita'],
  },
};

export const ROLE_DEFINITIONS = ROLE_KEYS.map((key) => ROLE_PROFILES[key]);

export function getRoleProfile(role: string): RoleProfile | undefined {
  return ROLE_PROFILES[role as RoleKey];
}

export function isValidRole(role: string): role is RoleKey {
  return ROLE_KEYS.includes(role as RoleKey);
}


// ============================================================
// ROLES & ROLE PROFILES
// ============================================================

