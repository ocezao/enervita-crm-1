export type LeadRoutingService = {
  key: string;
  label: string;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
};

export type LeadRoutingUser = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  roles: string[];
  ruleKey: string;
};

export type LeadRoutingPipeline = {
  key: string;
  label: string;
  userIds: string[];
};

export type LeadRoutingConfig = {
  randomEnabled: boolean;
  services: LeadRoutingService[];
  users: LeadRoutingUser[];
  pipelines: LeadRoutingPipeline[];
};

export type DistributionRule = {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  config: Record<string, unknown>;
};

export type DistributionRuleAssignment = {
  ruleKey: string;
  userId: string;
  config: Record<string, unknown>;
};

export type LeadRoutingUpdatePayload = {
  randomEnabled: boolean;
  userRules: Array<{ userId: string; ruleKey: string }>;
  pipelineAccess?: Array<{ pipelineKey: string; userIds: string[] }>;
};

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(url: string, init?: RequestInit, fallback = "Operacao nao concluida."): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    ...init,
  });
  if (!response.ok) throw new Error(await parseError(response, fallback));
  return (await response.json()) as T;
}

export const leadRoutingApi = {
  async get(): Promise<LeadRoutingConfig> {
    const body = await request<{ config: LeadRoutingConfig }>("/api/lead-routing", undefined, "Nao foi possivel carregar a atribuicao de leads.");
    return body.config;
  },

  async getRules(): Promise<DistributionRule[]> {
    const body = await request<{ rules: DistributionRule[] }>("/api/lead-routing/rules", undefined, "Nao foi possivel carregar as regras de distribuicao.");
    return body.rules;
  },

  async updateRule(ruleKey: string, input: { isActive?: boolean; priority?: number; config?: Record<string, unknown> }): Promise<DistributionRule> {
    const body = await request<{ rule: DistributionRule }>(
      `/api/lead-routing/rules/${ruleKey}`,
      { method: "PUT", body: JSON.stringify(input) },
      "Nao foi possivel atualizar a regra.",
    );
    return body.rule;
  },

  async getRuleAssignments(ruleKey: string): Promise<DistributionRuleAssignment[]> {
    const body = await request<{ assignments: DistributionRuleAssignment[] }>(`/api/lead-routing/rules/${ruleKey}/assignments`, undefined, "Nao foi possivel carregar as atribuicoes.");
    return body.assignments;
  },

  async updateRuleAssignment(ruleKey: string, userId: string, config: Record<string, unknown>): Promise<DistributionRuleAssignment> {
    const body = await request<{ assignment: DistributionRuleAssignment }>(
      `/api/lead-routing/rules/${ruleKey}/assignments/${userId}`,
      { method: "PUT", body: JSON.stringify(config) },
      "Nao foi possivel atualizar a atribuicao.",
    );
    return body.assignment;
  },

  async update(payload: LeadRoutingUpdatePayload): Promise<LeadRoutingConfig> {
    const body = await request<{ config: LeadRoutingConfig }>(
      "/api/lead-routing",
      { method: "PUT", body: JSON.stringify(payload) },
      "Nao foi possivel salvar a atribuicao de leads.",
    );
    return body.config;
  },
};
