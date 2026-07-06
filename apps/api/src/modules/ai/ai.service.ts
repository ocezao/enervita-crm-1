import pg from "pg";
import type { PipelineStageKey } from "@enervita/shared";
import type { AiConfig } from "../../config/env.ts";
import type { PublicUser } from "../auth/userRepository.ts";
import { assertSafeAiSelect } from "./sqlGuard.ts";

const { Pool } = pg;

export type AiSqlRunner = {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  close?(): Promise<void>;
};

export type AiAssistantOptions = {
  config: AiConfig;
  sqlRunner: AiSqlRunner;
  fetchImpl?: typeof fetch;
  crmBaseUrl?: string;
};

type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

const STRICT_SYSTEM_PROMPT = `Voc?? ?? o Assistente IA do CRM da Enervita. 
Seu papel ?? ajudar o usu??rio a entender os dados do CRM consultando o banco de dados (somente leitura) e, quando relevante, tirando prints da interface via ferramenta para confirmar contexto visual.

REGRAS OBRIGAT??RIAS DE LINGUAGEM E POSTURA (NUNCA VIOL E):
- NUNCA afirme nada de forma definitiva ou absoluta.
- Sempre use frases como: "Segundo os dados que tenho...", "De acordo com as informa????es dispon??veis no banco...", "Acredito que ... com base nos dados extra??dos".
- Em qualquer ponto de import??ncia, incerteza ou quando falar de c??digo, tabelas, leads ou decis??es: SEMPRE avise que ?? uma LLM e pode n??o compreender o contexto completo. Exemplo: "... mas posso n??o estar compreendendo o prop??sito completo deste c??digo/tabela/contexto. Recomendo confirmar com o time."
- Se encontrar algo que parece problema, inconsist??ncia ou erro: NUNCA diga "est?? errado", "o c??digo est?? incorreto", "isso ?? um bug". Em vez disso: "Baseado nos dados extra??dos parece que..., por??m posso estar faltando o prop??sito completo e recomendo o time revisar."
- O usu??rio frequentemente se refere a coisas que ele est?? vendo na UI do CRM. Sempre que fizer sentido, use a ferramenta de screenshot para "ver" e confirmar por voc?? mesmo antes de responder com confian??a.
- Voc?? tem acesso SOMENTE LEITURA. Nunca sugira ou execute mudan??as.

Capacidades permitidas (via tools):
- Consultar tabelas do CRM (SELECT seguro).
- Tirar screenshot de telas do CRM para entender o que o usu??rio est?? vendo.

Responda sempre em portugu??s brasileiro, de forma clara, ??til e humilde.

Tabelas principais dispon??veis (use apenas estas e as listadas no guard): clients, crm_offers, crm_leads, crm_sdr_activities, crm_tracking_events, crm_integrations, crm_access_tracking, crm_onboarding, crm_tasks, crm_decisions, contacts, form_submissions, events e outras permitidas no sqlGuard.`;

const RUN_CRM_SELECT_TOOL = {
  type: "function" as const,
  function: {
    name: "run_crm_select",
    description: "Executa SELECT read-only em tabelas CRM permitidas. Sempre inclua LIMIT e filtre por tenant quando poss??vel.",
    parameters: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL SELECT completo com placeholders $1 (tenant), $2 (stages se aplic??vel) e LIMIT expl??cito." }
      },
      required: ["sql"]
    }
  }
};

const CAPTURE_SCREENSHOT_TOOL = {
  type: "function" as const,
  function: {
    name: "capture_crm_screenshot",
    description: "Tira um print de uma tela do CRM para o assistente poder ver o contexto que o usu??rio est?? descrevendo na UI. Use quando o usu??rio mencionar algo que est?? vendo (ex: lista de leads, tarefa espec??fica, funil).",
    parameters: {
      type: "object",
      properties: {
        view: { type: "string", description: "Descri????o da tela ou se????o que o usu??rio mencionou (ex: leads do Jo??o, tarefas pendentes, funil de propostas)." },
        path: { type: "string", description: "Caminho relativo opcional da p??gina no CRM (ex: /leads, /tasks). Se n??o souber, deixe vazio." }
      },
      required: ["view"]
    }
  }
};

function clampLimit(sql: string): string {
  return sql.replace(/\blimit\s+(\d+)\b/ig, (_m, raw) => {
    const n = Math.min(Math.max(Number(raw) || 20, 1), 50);
    return `LIMIT ${n}`;
  });
}

function parseToolArgs(raw: string): { sql?: string; view?: string; path?: string } {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function safeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.slice(0, 50).map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (/password|hash|token|secret|key/i.test(k)) continue;
      clean[k] = v;
    }
    return clean;
  });
}

async function callLlm(config: AiConfig, messages: LlmMessage[], fetchImpl: typeof fetch): Promise<LlmMessage> {
  const base = (config.baseUrl || "https://token-plan-sgp.xiaomimimo.com/v1").replace(/\/$/, "");
  const url = base + "/chat/completions";

  const headers: Record<string, string> = { "content-type": "application/json" };
  headers["api-key"] = config.apiKey;  // Xiaomi / MiMo style

  const body: any = {
    model: config.model || "mimo-v2.5",
    temperature: 0.1,
    messages,
    tools: [RUN_CRM_SELECT_TOOL, CAPTURE_SCREENSHOT_TOOL],
    tool_choice: "auto",
    max_tokens: 1200
  };

  const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Xiaomi error " + res.status + ": " + txt.slice(0, 400));
  }

  const data: any = await res.json();
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new Error("Xiaomi retornou mensagem vazia.");
  return msg;
}

async function captureScreenshot(view: string, path: string | undefined, crmBaseUrl: string): Promise<string> {
  try {
    const pw: typeof import("playwright") | null = await import("playwright").catch(() => null);
    if (!pw || !pw.chromium) {
      return "Playwright n??o dispon??vel neste ambiente ainda. Configure o container do API com npx playwright install --with-deps chromium. Contexto visual n??o capturado para: " + view + ". Lembre: posso n??o compreender o contexto completo.";
    }
    const { chromium } = pw;
    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const target = (path || "/").startsWith("/") ? path : "/" + (path || "");
    const url = (crmBaseUrl || "http://enervita-prod-crm-web").replace(/\/$/, "") + target;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 }).catch((err) => {
      console.warn(`[AI Screenshot] Failed to load page ${url}:`, err);
    });
    const title = await page.title().catch(() => "CRM");
    const html = await page.content().catch(() => "");
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 900);
    await browser.close();
    return "Screenshot de \"" + view + "\" (url: " + url + "). T??tulo: " + title + ". Resumo visual: " + text + "... (use para responder com contexto da UI que o usu??rio est?? vendo)";
  } catch (e: any) {
    return "Falha ao capturar screenshot para \"" + view + "\": " + (e?.message || e) + ". Recomendo confirmar com o time. Posso n??o ter o contexto visual completo.";
  }
}

export async function answerAiChat(
  options: AiAssistantOptions,
  user: PublicUser,
  userMessage: string
): Promise<{ answer: string; sqlQueries: string[]; toolResults?: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const crmBase = options.crmBaseUrl || "http://enervita-prod-crm-web";

  // For??ar Xiaomi conforme pedido (ignorar openrouter)
  options.config.provider = "mimo" as any;
  if (!options.config.baseUrl) options.config.baseUrl = "https://token-plan-sgp.xiaomimimo.com/v1";

  if (!options.config.apiKey) {
    return { answer: "Chave do provedor Xiaomi ainda n??o configurada. O assistente ficar?? dispon??vel ap??s a entrega da chave.", sqlQueries: [] };
  }

  const allowedStages: PipelineStageKey[] | null = (user.allowedStages && user.allowedStages.length === 0) ? null : (user.allowedStages as any);
  const sqlParams = [user.tenantId, allowedStages];
  const sqlQueries: string[] = [];
  const toolResults: string[] = [];

  const messages: LlmMessage[] = [
    { role: "system", content: STRICT_SYSTEM_PROMPT },
    { role: "user", content: "Pergunta: " + userMessage + "\nContexto tenant=$1 stages=$2. Use tools para dados e prints. Siga SEMPRE as regras de hedging." }
  ];

  for (let step = 0; step < 4; step++) {
    const assistant = await callLlm(options.config, messages, fetchImpl);
    messages.push(assistant);

    const toolCalls = assistant.tool_calls || [];
    if (toolCalls.length === 0) {
      return { answer: assistant.content || "Sem resposta completa.", sqlQueries, toolResults };
    }

    for (const tc of toolCalls) {
      const args = parseToolArgs(tc.function.arguments || "{}");
      if (tc.function.name === "run_crm_select" && args.sql) {
        try {
          const sql = clampLimit(args.sql.trim().replace(/;\s*$/u, ""));
          assertSafeAiSelect(sql);
          const res = await options.sqlRunner.query(sql, sqlParams);
          sqlQueries.push(sql);
          toolResults.push("SELECT: " + sql.substring(0,80));
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ rows: safeRows(res.rows) }) });
        } catch (err: any) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Erro na leitura: " + err.message + ". Posso n??o compreender todo contexto." }) });
        }
      } else if (tc.function.name === "capture_crm_screenshot") {
        const shot = await captureScreenshot(args.view || "tela mencionada", args.path, crmBase);
        toolResults.push("SCREENSHOT: " + (args.view || ""));
        messages.push({ role: "tool", tool_call_id: tc.id, content: shot });
      }
    }
  }

  return {
    answer: "N??o consegui concluir em tempo seguro. Segundo os dados que tenho, recomendo confirmar com o time. Posso n??o compreender todo o contexto.",
    sqlQueries,
    toolResults
  };
}

export function createPgAiSqlRunner(databaseUrl: string): AiSqlRunner {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    async query(sql, params) { const r = await pool.query(sql, params); return { rows: r.rows }; },
    async close() { await pool.end(); }
  };
}
