const ALLOWED_TABLES = new Set([
  "leads",
  "contacts",
  "tasks",
  "activities",
  "proposals",
  "ad_campaigns",
  "ad_sets",
  "ads",
  "tracking_events",
  "lead_stage_history",
  "lead_tags",
  "lead_tag_assignments",
  "clients",
  "crm_offers",
  "crm_leads",
  "crm_sdr_activities",
  "crm_tracking_events",
  "crm_integrations",
  "crm_access_tracking",
  "crm_onboarding",
  "crm_tasks",
  "crm_decisions",
  "form_submissions",
  "events"
]);

const FORBIDDEN_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|execute|call|merge|vacuum|analyze|refresh|listen|notify)\b/i;

export function assertSafeAiSelect(sql: string): void {
  const normalized = sql.trim().replace(/;\s*$/u, "");
  if (!/^select\b/i.test(normalized)) {
    throw new Error("Only SELECT queries are allowed for the AI assistant.");
  }
  if (FORBIDDEN_SQL.test(normalized)) {
    throw new Error("Only read-only SELECT queries are allowed for the AI assistant.");
  }
  if (!/\blimit\s+\d+\b/i.test(normalized)) {
    throw new Error("AI assistant queries must include a LIMIT.");
  }
  const tableRefs = [...normalized.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)].map((match) => match[1]?.toLowerCase()).filter(Boolean);
  if (tableRefs.length === 0) {
    throw new Error("AI assistant query must read from an allowlisted CRM table.");
  }
  for (const table of tableRefs) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error("Table '" + table + "' is not in the AI assistant allowlist.");
    }
  }
}
