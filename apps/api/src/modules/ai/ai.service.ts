import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';
import type { AiConfig } from '../../config/env.ts';
import type { PublicUser } from '../auth/userRepository.ts';
import { assertSafeAiSelect } from './sqlGuard.ts';

const { Pool } = pg;

export type AiSqlRunner = {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  close?(): Promise<void>;
};

export type AiAssistantOptions = {
  config: AiConfig;
  sqlRunner: AiSqlRunner;
  fetchImpl?: typeof fetch;
};

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
};

const SYSTEM_PROMPT = `Você é o Assistente IA do CRM da Enervita.
Responda em português, de forma objetiva, comercial e útil.
Você pode consultar o CRM usando a tool run_crm_select.
Regras obrigatórias:
- somente consultas SELECT;
- sempre filtrar pelo tenant_id informado;
- respeitar allowed_stages: se não for null, filtrar leads por stage = any($2::lead_stage[]) quando consultar leads ou joins com leads;
- sempre usar LIMIT <= 50;
- nunca retornar senhas, hashes, tokens, segredos ou dados fora das tabelas CRM permitidas;
- se não houver dados suficientes, diga isso claramente.
Tabelas úteis: leads, contacts, tasks, activities, proposals, ad_campaigns, ad_sets, ads, tracking_events, lead_stage_history, lead_tags, lead_tag_assignments.`;

function clampLimit(sql: string): string {
  return sql.replace(/\blimit\s+(\d+)\b/ig, (_match, raw) => {
    const n = Math.min(Math.max(Number(raw) || 20, 1), 50);
    return `limit ${n}`;
  });
}

function parseToolArgs(raw: string): { sql: string } {
  const parsed = JSON.parse(raw || '{}') as { sql?: unknown };
  if (typeof parsed.sql !== 'string') throw new Error('Tool argument sql is required.');
  return { sql: parsed.sql };
}

function safeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.slice(0, 50).map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (/password|hash|token|secret/i.test(key)) continue;
      clean[key] = value;
    }
    return clean;
  });
}

async function callOpenRouter(config: AiConfig, messages: OpenRouterMessage[], fetchImpl: typeof fetch): Promise<OpenRouterMessage> {
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
      'http-referer': 'https://crm.enervita.com.br',
      'x-title': 'Enervita CRM AI Assistant',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'run_crm_select',
            description: 'Executa uma consulta SELECT read-only em tabelas CRM permitidas. Use placeholders $1 para tenant_id e $2 para allowed_stages quando necessário.',
            parameters: {
              type: 'object',
              properties: {
                sql: { type: 'string', description: 'Consulta SQL SELECT com LIMIT e placeholders PostgreSQL.' },
              },
              required: ['sql'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: OpenRouterMessage }> };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('OpenRouter returned no assistant message.');
  return message;
}

export async function answerAiChat(options: AiAssistantOptions, user: PublicUser, userMessage: string): Promise<{ answer: string; sqlQueries: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const allowedStages: PipelineStageKey[] | null = user.allowedStages.length === 0 ? null : (user.allowedStages as PipelineStageKey[]);
  const params = [user.tenantId, allowedStages];
  const sqlQueries: string[] = [];
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        question: userMessage,
        tenant_id_placeholder: '$1',
        allowed_stages_placeholder: '$2',
        allowed_stages: allowedStages,
      }),
    },
  ];

  for (let step = 0; step < 3; step += 1) {
    const assistant = await callOpenRouter(options.config, messages, fetchImpl);
    messages.push(assistant);

    const toolCalls = assistant.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { answer: assistant.content || 'Não consegui gerar uma resposta com os dados disponíveis.', sqlQueries };
    }

    for (const toolCall of toolCalls) {
      if (toolCall.function.name !== 'run_crm_select') continue;
      try {
        const args = parseToolArgs(toolCall.function.arguments);
        const sql = clampLimit(args.sql.trim().replace(/;\s*$/u, ''));
        assertSafeAiSelect(sql);
        const result = await options.sqlRunner.query(sql, params);
        sqlQueries.push(sql);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ rows: safeRows(result.rows) }) });
      } catch (error) {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao consultar CRM.' }) });
      }
    }
  }

  return { answer: 'Não consegui concluir a análise em tempo seguro. Tente uma pergunta mais específica.', sqlQueries };
}

export function createPgAiSqlRunner(databaseUrl: string): AiSqlRunner {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    async query(sql, params) {
      const result = await pool.query(sql, params);
      return { rows: result.rows };
    },
    async close() {
      await pool.end();
    },
  };
}
