import pg, { type PoolClient } from 'pg';
import type { AuditContext } from '../users/repository.ts';

const { Pool } = pg;

export type AutomationStatus = 'planned' | 'active' | 'paused';
export type N8nWorkflowStatus = 'active' | 'paused' | 'archived';
export type WebhookStatus = 'planned' | 'active' | 'inactive' | 'failing';
export type DeliveryStatus = 'queued' | 'sent' | 'failed';
export type AutomationRunStatus = 'queued' | 'success' | 'failed';

export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  active: boolean;
  status: AutomationStatus;
  lastRunAt?: string;
};

export type N8nWorkflow = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  status: N8nWorkflowStatus;
  triggerSummary: string;
  nodeSummary: string[];
  webhookPaths: string[];
  updatedAt?: string;
  versionId?: string | null;
  activeVersionId?: string | null;
};

export type N8nWorkflowToggleResult = {
  workflow: N8nWorkflow;
  message: string;
};

export type WebhookDefinition = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  status: WebhookStatus;
  lastDeliveryAt?: string;
  successRate: number;
  secretConfigured: boolean;
};

export type AutomationRun = {
  id: string;
  automationId: string;
  status: AutomationRunStatus;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
};

export type WebhookDelivery = {
  id: string;
  tenantId?: string;
  webhookId: string;
  webhookName?: string;
  eventType: string;
  status: DeliveryStatus;
  httpStatus: number | null;
  attempts: number;
  createdAt: string;
  deliveredAt?: string | null;
  responseBody?: string | null;
};

export type WebhookTestResult = {
  success: boolean;
  message: string;
  delivery: WebhookDelivery;
  contextTenantId?: string;
};

export type IntegrationsRepository = {
  listAutomations(tenantId: string): Promise<AutomationRule[]>;
  listN8nWorkflows(): Promise<N8nWorkflow[]>;
  setN8nWorkflowActive(id: string, active: boolean): Promise<N8nWorkflowToggleResult>;
  listWebhooks(tenantId: string): Promise<WebhookDefinition[]>;
  listWebhookDeliveries(context: AuditContext, limit?: number): Promise<WebhookDelivery[]>;
  runAutomation(context: AuditContext, id: string, inputPayload: Record<string, unknown>): Promise<AutomationRun>;
  testWebhook(context: AuditContext, id: string): Promise<WebhookTestResult>;
  close?(): Promise<void>;
};

export class N8nUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'N8nUnavailableError';
  }
}

export class IntegrationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationNotFoundError';
  }
}

const AUTOMATION_SLUGS: Record<string, { name: string; trigger: string }> = {
  'lead-no-followup-12h': { name: 'Alerta de lead sem follow-up em 12h', trigger: 'lead.no_followup_12h' },
  'proposal-open-48h': { name: 'Retorno de proposta aberta em 48h', trigger: 'proposal.open_48h' },
};

const WEBHOOK_SLUGS: Record<string, { name: string; eventTypes: string[] }> = {
  'n8n-lead-created': { name: 'Lead criado', eventTypes: ['lead.created'] },
  'n8n-stage-changed': { name: 'Mudança de etapa', eventTypes: ['lead.stage_changed'] },
};

const N8N_WORKFLOW_DESCRIPTIONS: Record<string, string> = {
  'env-crm-preview-webhook-homologacao': 'Recebe eventos do CRM custom (lead criado, mudança de etapa, proposta aberta e validação) e confirma a integração com os fluxos comerciais.',
  'env-daily-health': 'Executa checagens diárias de saúde e backup consultando serviços internos e banco para acompanhar a operação Enervita.',
  'env-events-to-openpanel': 'Lê eventos comerciais da Enervita e envia métricas comportamentais para o painel de acompanhamento.',
  'env-ai-vectorization-embeddings': 'Processa dados persistentes para preparar base de IA e busca semântica.',
  'env-lead-followup': 'Rotina planejada de follow-up para leads novos, consultando o banco e preparando próximos contatos comerciais.',
  'env-twenty-to-db': 'Sincroniza dados da base legada/CRM custom para o banco operacional da Enervita enquanto a migração é consolidada.',
  'env-leads-to-opps': 'Transforma leads do banco operacional em oportunidades no CRM custom da Enervita.',
  'env-leads-to-people': 'Sincroniza leads capturados no site para contatos/pessoas no CRM custom da Enervita.',
};

const N8N_WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  'env-leads-to-opps': 'Enervita | Banco Enervita -> Oportunidades CRM Custom',
  'env-leads-to-people': 'Enervita | Leads do Site -> Contatos CRM Custom',
  'env-twenty-to-db': 'Enervita | CRM Custom/Legado -> Banco Enervita',
  'env-crm-preview-webhook-homologacao': 'Enervita | Entradas Comerciais do CRM',
};

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function nodeTypeLabel(type: string): string {
  const clean = type.replace('n8n-nodes-base.', '');
  const labels: Record<string, string> = { webhook: 'Entrada', respondToIntegração: 'Confirmação', manualTrigger: 'Gatilho manual', scheduleTrigger: 'Agenda', postgres: 'Banco de dados', httpRequest: 'Integração externa', code: 'Regra', if: 'Condição' };
  return labels[clean] ?? clean;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function workflowDescription(id: string, name: string, dbDescription: unknown, nodes: Record<string, unknown>[]): string {
  if (N8N_WORKFLOW_DESCRIPTIONS[id]) return N8N_WORKFLOW_DESCRIPTIONS[id];
  if (typeof dbDescription === 'string' && dbDescription.trim()) return dbDescription.trim();
  const labels = uniqueStrings(nodes.map((node) => typeof node.type === 'string' ? node.type : '').map(nodeTypeLabel));
  if (labels.includes('Entrada')) return `Recebe eventos comerciais e executa o fluxo ${name}.`;
  if (labels.includes('Agenda')) return `Executa o fluxo ${name} automaticamente por agenda.`;
  return `Fluxo ${name} cadastrado para a operação Enervita.`;
}

function workflowTriggerSummary(nodes: Record<string, unknown>[]): string {
  const labels = uniqueStrings(nodes.map((node) => typeof node.type === 'string' ? node.type : '').map(nodeTypeLabel));
  const triggers = labels.filter((label) => ['Entrada', 'Agenda', 'Gatilho manual'].includes(label));
  return triggers.length ? triggers.join(' + ') : 'Sem gatilho identificado';
}

function workflowIntegraçãoPaths(nodes: Record<string, unknown>[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'n8n-nodes-base.webhook') return [];
    const parameters = objectPayload(node.parameters);
    const path = typeof parameters.path === 'string' ? parameters.path : '';
    const method = typeof parameters.httpMethod === 'string' ? parameters.httpMethod.toUpperCase() : 'POST';
    return path ? [`${method} /webhook/${path}`] : [];
  });
}

function rowToN8nWorkflow(row: Record<string, unknown>): N8nWorkflow {
  const nodes = asRecordArray(row.nodes);
  const activeVersionId = typeof row.activeVersionId === 'string' ? row.activeVersionId : null;
  const archived = Boolean(row.isArchived);
  const id = String(row.id);
  const name = N8N_WORKFLOW_DISPLAY_NAMES[id] ?? String(row.name);
  return { id, name, description: workflowDescription(id, name, row.description, nodes), active: Boolean(activeVersionId) && !archived, status: archived ? 'archived' : activeVersionId ? 'active' : 'paused', triggerSummary: workflowTriggerSummary(nodes), nodeSummary: uniqueStrings(nodes.map((node) => typeof node.type === 'string' ? node.type : '').map(nodeTypeLabel)).slice(0, 8), webhookPaths: workflowIntegraçãoPaths(nodes), updatedAt: row.updatedAt as string | undefined, versionId: typeof row.versionId === 'string' ? row.versionId : null, activeVersionId };
}

function requireN8nPool(pool: pg.Pool | null): pg.Pool {
  if (!pool) throw new N8nUnavailableError('Integração operacional ainda não está conectada ao CRM.');
  return pool;
}

async function getN8nWorkflow(pool: pg.Pool, id: string): Promise<N8nWorkflow> {
  const result = await pool.query(`select id, name, active, "activeVersionId", "versionId", "triggerCount", "updatedAt"::text as "updatedAt", nodes, description, "isArchived" from workflow_entity where id = $1 limit 1`, [id]);
  if (!result.rows[0]) throw new IntegrationNotFoundError('Fluxo operacional não encontrado');
  return rowToN8nWorkflow(result.rows[0]);
}

function webhookRowsFromNodes(nodes: Record<string, unknown>[]): Array<{ path: string; method: string; node: string }> {
  return nodes.flatMap((node) => {
    if (node.type !== 'n8n-nodes-base.webhook') return [];
    const parameters = objectPayload(node.parameters);
    const path = typeof parameters.path === 'string' ? parameters.path.trim() : '';
    const method = typeof parameters.httpMethod === 'string' ? parameters.httpMethod.toUpperCase() : 'POST';
    const nodeName = typeof node.name === 'string' ? node.name : 'Integração';
    return path ? [{ path, method, node: nodeName }] : [];
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function automationSlug(row: Record<string, unknown>): string {
  const trigger = row.trigger as string;
  const matched = Object.entries(AUTOMATION_SLUGS).find(([, candidate]) => candidate.trigger === trigger || candidate.name === row.name);
  return matched?.[0] ?? String(row.id);
}

function webhookSlug(row: Record<string, unknown>): string {
  const name = row.name as string;
  const matched = Object.entries(WEBHOOK_SLUGS).find(([, candidate]) => candidate.name === name);
  return matched?.[0] ?? String(row.id);
}

function automationStatus(active: boolean): AutomationStatus {
  return active ? 'active' : 'paused';
}

function rowToAutomation(row: Record<string, unknown>): AutomationRule {
  const active = Boolean(row.active);
  return {
    id: automationSlug(row),
    name: row.name as string,
    trigger: row.trigger as string,
    conditions: stringArray(row.conditions),
    actions: stringArray(row.actions),
    active,
    status: automationStatus(active),
    lastRunAt: row.lastRunAt as string | undefined,
  };
}

function webhookStatus(status: unknown): WebhookStatus {
  return status === 'active' || status === 'inactive' || status === 'failing' ? status : 'planned';
}

function rowToWebhook(row: Record<string, unknown>): WebhookDefinition {
  return {
    id: webhookSlug(row),
    name: row.name as string,
    url: row.url as string,
    eventTypes: stringArray(row.eventTypes),
    status: webhookStatus(row.status),
    lastDeliveryAt: row.lastDeliveryAt as string | undefined,
    successRate: Number(row.successRate ?? 0),
    secretConfigured: Boolean(row.secretConfigured),
  };
}

function rowToRun(row: Record<string, unknown>, automationId: string): AutomationRun {
  return {
    id: row.id as string,
    automationId,
    status: row.status as AutomationRunStatus,
    inputPayload: objectPayload(row.inputPayload),
    outputPayload: objectPayload(row.outputPayload),
    errorMessage: row.errorMessage as string | null | undefined,
    startedAt: row.startedAt as string,
    finishedAt: row.finishedAt as string | null | undefined,
  };
}

function rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string | undefined,
    webhookId: row.webhookId ? webhookSlug({ id: row.webhookId, name: row.webhookName }) : String(row.webhookId ?? ''),
    webhookName: row.webhookName as string | undefined,
    eventType: row.eventType as string,
    status: row.status as DeliveryStatus,
    httpStatus: row.httpStatus as number | null,
    attempts: Number(row.attempts ?? 0),
    createdAt: row.createdAt as string,
    deliveredAt: row.deliveredAt as string | null | undefined,
    responseBody: row.responseBody as string | null | undefined,
  };
}

async function resolveAutomation(client: PoolClient, tenantId: string, id: string): Promise<Record<string, unknown> | null> {
  const slug = AUTOMATION_SLUGS[id];
  const result = await client.query(
    `select id, tenant_id as "tenantId", name, trigger, conditions, actions, active, last_run_at::text as "lastRunAt"
       from automation_rules
      where tenant_id = $1
        and (id::text = $2 or ($3::text is not null and name = $3) or ($4::text is not null and trigger = $4))
      limit 1`,
    [tenantId, id, slug?.name ?? null, slug?.trigger ?? null],
  );
  return result.rows[0] ?? null;
}

async function resolveWebhook(client: PoolClient, tenantId: string, id: string): Promise<Record<string, unknown> | null> {
  const slug = WEBHOOK_SLUGS[id];
  const result = await client.query(
    `select id, tenant_id as "tenantId", name, url, event_types as "eventTypes", status, success_rate::float as "successRate", last_delivery_at::text as "lastDeliveryAt", (secret_hash is not null) as "secretConfigured"
       from webhooks
      where tenant_id = $1
        and (id::text = $2 or ($3::text is not null and name = $3))
      limit 1`,
    [tenantId, id, slug?.name ?? null],
  );
  return result.rows[0] ?? null;
}

function eventTypeForAutomation(rule: Record<string, unknown>): string {
  return String(rule.trigger);
}

const STATIC_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'lead-no-followup-12h',
    name: 'Alerta de lead sem follow-up em 12h',
    trigger: 'lead.no_followup_12h',
    conditions: ['Lead em etapas comerciais sem atividade recente', 'Sem tarefa aberta para o responsável'],
    actions: ['Criar tarefa urgente para SDR', 'Notificar responsável comercial'],
    active: false,
    status: 'planned',
  },
  {
    id: 'proposal-open-48h',
    name: 'Retorno de proposta aberta em 48h',
    trigger: 'proposal.open_48h',
    conditions: ['Lead na etapa proposta_enviada', 'Sem atividade de retorno registrada'],
    actions: ['Criar tarefa de follow-up', 'Sugerir mensagem WhatsApp'],
    active: false,
    status: 'planned',
  },
];


const STATIC_N8N_WORKFLOWS: N8nWorkflow[] = [
  { id: 'env-crm-preview-webhook-homologacao', name: 'Enervita | CRM Custom Integrações', description: N8N_WORKFLOW_DESCRIPTIONS['env-crm-preview-webhook-homologacao'], active: true, status: 'active', triggerSummary: 'Entrada', nodeSummary: ['Entrada', 'Confirmação'], webhookPaths: ['POST /webhook/lead-created', 'POST /webhook/lead-stage-changed'] },
];

const STATIC_WEBHOOKS: WebhookDefinition[] = [
  {
    id: 'n8n-lead-created',
    name: 'Lead criado',
    url: 'https://integracoes.enervita.com.br/webhook/lead-created',
    eventTypes: ['lead.created'],
    status: 'planned',
    successRate: 0,
    secretConfigured: false,
  },
  {
    id: 'n8n-stage-changed',
    name: 'Mudança de etapa',
    url: 'https://integracoes.enervita.com.br/webhook/lead-stage-changed',
    eventTypes: ['lead.stage_changed'],
    status: 'planned',
    successRate: 0,
    secretConfigured: false,
  },
];

export function createStaticIntegrationsRepository(): IntegrationsRepository {
  const deliveries: WebhookDelivery[] = [];
  return {
    async listAutomations() {
      return STATIC_AUTOMATIONS.map((automation) => ({ ...automation, conditions: [...automation.conditions], actions: [...automation.actions] }));
    },
    async listN8nWorkflows() { return STATIC_N8N_WORKFLOWS.map((workflow) => ({ ...workflow, nodeSummary: [...workflow.nodeSummary], webhookPaths: [...workflow.webhookPaths] })); },
    async setN8nWorkflowActive(id, active) { const workflow = STATIC_N8N_WORKFLOWS.find((candidate) => candidate.id === id); if (!workflow) throw new IntegrationNotFoundError('Fluxo operacional não encontrado'); const updated = { ...workflow, active, status: active ? 'active' as const : 'paused' as const }; return { workflow: updated, message: active ? 'Fluxo operacional marcado como ativo.' : 'Fluxo operacional marcado como pausado.' }; },
    async listWebhooks() {
      return STATIC_WEBHOOKS.map((webhook) => ({ ...webhook, eventTypes: [...webhook.eventTypes] }));
    },
    async listWebhookDeliveries() {
      return [...deliveries];
    },
    async runAutomation(context, id, inputPayload) {
      const automation = STATIC_AUTOMATIONS.find((candidate) => candidate.id === id);
      if (!automation) throw new IntegrationNotFoundError('Automação não encontrada');
      return {
        id: 'static-run-1',
        automationId: id,
        status: 'success',
        inputPayload,
        outputPayload: { queuedIntegraçãoDeliveries: 0, externalHttpCalled: false, contextTenantId: context.tenantId },
        startedAt: new Date(0).toISOString(),
        finishedAt: new Date(0).toISOString(),
      };
    },
    async testWebhook(context, id) {
      const webhook = STATIC_WEBHOOKS.find((candidate) => candidate.id === id);
      if (!webhook) throw new IntegrationNotFoundError('Integração não encontrada');
      const delivery: WebhookDelivery = {
        id: `static-delivery-${deliveries.length + 1}`,
        tenantId: context.tenantId,
        webhookId: webhook.id,
        webhookName: webhook.name,
        eventType: 'webhook.validation',
        status: 'queued',
        httpStatus: null,
        attempts: 0,
        createdAt: new Date(0).toISOString(),
      };
      deliveries.unshift(delivery);
      return {
        success: true,
        message: `Validação da integração ${webhook.name} registrada na fila com segurança.`,
        delivery,
        contextTenantId: context.tenantId,
      };
    },
    async close() {},
  };
}

export function createPgIntegrationsRepository(databaseUrl: string, n8nDatabaseUrl?: string): IntegrationsRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  const n8nPool = n8nDatabaseUrl ? new Pool({ connectionString: n8nDatabaseUrl }) : null;

  return {
    async listAutomations(tenantId) {
      const result = await pool.query(
        `select id, name, trigger, conditions, actions, active, last_run_at::text as "lastRunAt"
           from automation_rules
          where tenant_id = $1
          order by name`,
        [tenantId],
      );
      return result.rows.map(rowToAutomation);
    },

    async listN8nWorkflows() {
      const result = await requireN8nPool(n8nPool).query(`select id, name, active, "activeVersionId", "versionId", "triggerCount", "updatedAt"::text as "updatedAt", nodes, description, "isArchived" from workflow_entity where coalesce("isArchived", false) = false order by name`);
      return result.rows.map(rowToN8nWorkflow);
    },

    async setN8nWorkflowActive(id, active) {
      const n8n = requireN8nPool(n8nPool);
      const client = await n8n.connect();
      try {
        await client.query('begin');
        const current = await client.query(`select id, name, active, "activeVersionId", "versionId", "updatedAt"::text as "updatedAt", nodes, description, "isArchived" from workflow_entity where id = $1 limit 1`, [id]);
        if (!current.rows[0]) throw new IntegrationNotFoundError('Fluxo operacional não encontrado');
        if (current.rows[0].isArchived) throw new IntegrationNotFoundError('Fluxo operacional arquivado não pode ser alterado pelo CRM');
        const nodes = asRecordArray(current.rows[0].nodes);
        if (active) {
          const versionId = current.rows[0].activeVersionId ?? current.rows[0].versionId;
          await client.query(`update workflow_entity set active = true, "activeVersionId" = $2, "updatedAt" = now() where id = $1`, [id, versionId]);
          await client.query('delete from webhook_entity where "workflowId" = $1', [id]);
          for (const webhook of webhookRowsFromNodes(nodes)) await client.query(`insert into webhook_entity ("webhookPath", method, node, "workflowId") values ($1, $2, $3, $4)`, [webhook.path, webhook.method, webhook.node, id]);
        } else {
          await client.query(`update workflow_entity set active = false, "activeVersionId" = null, "updatedAt" = now() where id = $1`, [id]);
          await client.query('delete from webhook_entity where "workflowId" = $1', [id]);
        }
        await client.query('commit');
        const workflow = await getN8nWorkflow(n8n, id);
        return { workflow, message: active ? 'Fluxo despausado. Entradas de produção foram registradas novamente quando aplicável.' : 'Fluxo pausado. Entradas de produção foram removidas quando aplicável.' };
      } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    },

    async listWebhooks(tenantId) {
      const result = await pool.query(
        `select id, name, url, event_types as "eventTypes", status, success_rate::float as "successRate", last_delivery_at::text as "lastDeliveryAt", (secret_hash is not null) as "secretConfigured"
           from webhooks
          where tenant_id = $1
          order by name`,
        [tenantId],
      );
      return result.rows.map(rowToWebhook);
    },

    async listWebhookDeliveries(context, limit = 20) {
      const result = await pool.query(
        `select d.id, d.tenant_id as "tenantId", d.webhook_id as "webhookId", w.name as "webhookName", d.event_type as "eventType", d.status::text as status,
                d.http_status as "httpStatus", d.attempts, d.response_body as "responseBody", d.delivered_at::text as "deliveredAt", d.created_at::text as "createdAt"
           from webhook_deliveries d
           join webhooks w on w.tenant_id = d.tenant_id and w.id = d.webhook_id
          where d.tenant_id = $1
          order by d.created_at desc
          limit $2`,
        [context.tenantId, Math.max(1, Math.min(100, limit))],
      );
      return result.rows.map(rowToDelivery);
    },

    async runAutomation(context, id, inputPayload) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const rule = await resolveAutomation(client, context.tenantId, id);
        if (!rule) throw new IntegrationNotFoundError('Automação não encontrada');
        const eventType = eventTypeForAutomation(rule);
        const matchingIntegraçãos = await client.query(
          `select id from webhooks
            where tenant_id = $1
              and status = 'active'
              and ($2 = any(event_types) or 'automation.run' = any(event_types))`,
          [context.tenantId, eventType],
        );
        for (const webhook of matchingIntegraçãos.rows) {
          await client.query(
            `insert into webhook_deliveries (tenant_id, webhook_id, event_type, payload, status, attempts)
             values ($1, $2, $3, $4::jsonb, 'queued', 0)`,
            [context.tenantId, webhook.id, eventType, JSON.stringify({ automationId: id, input: inputPayload, source: 'crm-automation-run' })],
          );
        }
        const outputPayload = { queuedIntegraçãoDeliveries: matchingIntegraçãos.rowCount ?? 0, externalHttpCalled: false };
        const runResult = await client.query(
          `insert into automation_runs (tenant_id, rule_id, status, input_payload, output_payload, finished_at)
           values ($1, $2, 'success', $3::jsonb, $4::jsonb, now())
           returning id, status, input_payload as "inputPayload", output_payload as "outputPayload", error_message as "errorMessage", started_at::text as "startedAt", finished_at::text as "finishedAt"`,
          [context.tenantId, rule.id, JSON.stringify(inputPayload), JSON.stringify(outputPayload)],
        );
        await client.query('update automation_rules set last_run_at = now(), updated_at = now() where tenant_id = $1 and id = $2', [context.tenantId, rule.id]);
        await client.query('commit');
        return rowToRun(runResult.rows[0], automationSlug(rule));
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async testWebhook(context, id) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const webhook = await resolveWebhook(client, context.tenantId, id);
        if (!webhook) throw new IntegrationNotFoundError('Integração não encontrada');
        const payload = { kind: 'webhook.validation', source: 'crm-validation', sentBy: context.actorUserId };
        const result = await client.query(
          `insert into webhook_deliveries (tenant_id, webhook_id, event_type, payload, status, attempts)
           values ($1, $2, 'webhook.validation', $3::jsonb, 'queued', 0)
           returning id, tenant_id as "tenantId", webhook_id as "webhookId", 'webhook.validation' as "eventType", status::text, http_status as "httpStatus", attempts, response_body as "responseBody", delivered_at::text as "deliveredAt", created_at::text as "createdAt"`,
          [context.tenantId, webhook.id, JSON.stringify(payload)],
        );
        await client.query('update webhooks set last_delivery_at = now(), updated_at = now() where tenant_id = $1 and id = $2', [context.tenantId, webhook.id]);
        await client.query('commit');
        return {
          success: true,
          message: `Validação da integração ${webhook.name} registrada na fila com segurança.`,
          delivery: rowToDelivery({ ...result.rows[0], webhookName: webhook.name }),
          contextTenantId: context.tenantId,
        };
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
      await n8nPool?.end();
    },
  };
}
