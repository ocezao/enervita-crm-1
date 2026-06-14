import pg from "pg";
import { readEnv } from "../src/config/env.ts";
import { createPgNotificationsRepository } from "../src/modules/notifications/repository.ts";

const env = readEnv();
const tenantIdFromEnv = process.env.NOTIFICATION_RULES_TENANT_ID?.trim();
const tenantSlug =
  process.env.NOTIFICATION_RULES_TENANT_SLUG?.trim() || "enervita";

async function resolveTenantId(databaseUrl: string): Promise<string> {
  if (tenantIdFromEnv) return tenantIdFromEnv;

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(
      "select id from tenants where slug = $1 limit 1",
      [tenantSlug],
    );
    const tenantId = result.rows[0]?.id;
    if (!tenantId) throw new Error(`Tenant not found for slug: ${tenantSlug}`);
    return tenantId;
  } finally {
    await pool.end();
  }
}

const repository = createPgNotificationsRepository(env.databaseUrl);

try {
  const tenantId = await resolveTenantId(env.databaseUrl);
  const result = await repository.runCommercialRules(tenantId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        tenantSlug: tenantIdFromEnv ? null : tenantSlug,
        ...result,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await repository.close?.();
}
