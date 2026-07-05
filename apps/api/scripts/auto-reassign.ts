import pg from "pg";
import { readEnv } from "../src/config/env.ts";
import { randomUUID } from "crypto";

const { Pool } = pg;

type ReassignResult = {
  leadId: string;
  fromSeller: string;
  fromSellerName: string;
  toSeller: string;
  toSellerName: string;
  contactName: string;
  serviceKey: string;
  reassignmentCount: number;
};

type AutoReassignOutput = {
  ok: boolean;
  enabled: boolean;
  reassignments: ReassignResult[];
  notifications: { type: string; count: number }[];
  errors: string[];
};

const env = readEnv();
const tenantSlug = process.env.NOTIFICATION_RULES_TENANT_SLUG?.trim() || "enervita";

async function resolveTenantId(pool: pg.Pool): Promise<string> {
  const result = await pool.query("select id from tenants where slug = $1 limit 1", [tenantSlug]);
  const tenantId = result.rows[0]?.id;
  if (!tenantId) throw new Error(`Tenant not found for slug: ${tenantSlug}`);
  return tenantId;
}

async function firstAdminUser(pool: pg.Pool, tenantId: string): Promise<string | null> {
  const result = await pool.query(
    `select u.id from users u
     join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
     join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
     where u.tenant_id = $1 and r.name = 'admin' and u.status = 'active'
     limit 1`,
    [tenantId],
  );
  return (result.rows[0]?.id as string) ?? null;
}

async function getUserName(pool: pg.Pool, tenantId: string, userId: string): Promise<string> {
  const result = await pool.query("select name from users where tenant_id = $1 and id = $2", [tenantId, userId]);
  return (result.rows[0]?.name as string) ?? "Vendedor";
}

function timeAgoLabel(days: number): string {
  if (days >= 1) return `${Math.floor(days)} dia${Math.floor(days) > 1 ? "s" : ""}`;
  const hours = Math.floor(days * 24);
  return `${hours} hora${hours > 1 ? "s" : ""}`;
}

async function createNotificationIfMissing(
  pool: pg.Pool,
  input: {
    tenantId: string;
    userId: string;
    leadId?: string;
    type: string;
    severity: string;
    title: string;
    body: string;
    href: string;
    metadata: Record<string, unknown>;
  },
): Promise<boolean> {
  const rule = String(input.metadata.rule ?? input.type);
  const entityId = String(input.metadata.entityId ?? "");
  const bucket = String(input.metadata.bucket ?? "");
  if (!entityId || !bucket) return false;

  const existing = await pool.query(
    `select id from notifications where tenant_id = $1 and user_id = $2 and metadata->>'rule' = $3 and metadata->>'entityId' = $4 and metadata->>'bucket' = $5 limit 1`,
    [input.tenantId, input.userId, rule, entityId, bucket],
  );
  if ((existing.rowCount ?? 0) > 0) return false;

  await pool.query(
    `insert into notifications (id, tenant_id, user_id, lead_id, type, severity, title, body, href, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [randomUUID(), input.tenantId, input.userId, input.leadId ?? null, input.type, input.severity, input.title, input.body, input.href, JSON.stringify(input.metadata)],
  );
  return true;
}

async function runAutoReassign(): Promise<AutoReassignOutput> {
  const pool = new Pool({ connectionString: env.databaseUrl });
  const result: AutoReassignOutput = { ok: false, enabled: false, reassignments: [], notifications: [], errors: [] };

  try {
    const tenantId = await resolveTenantId(pool);
    const adminUserId = await firstAdminUser(pool, tenantId);
    const bucket = new Date().toISOString().slice(0, 10);

    // 1. Verificar se auto-reassign está habilitado
    const configResult = await pool.query(
      `select auto_reassign_enabled, auto_reassign_activated_at from pipeline_rules_config where tenant_id = $1 and pipeline_key = 'geral' limit 1`,
      [tenantId],
    );
    const config = configResult.rows[0];
    if (!config?.auto_reassign_enabled) {
      result.ok = true;
      result.enabled = false;
      return result;
    }
    result.enabled = true;

    const activatedAt = config.auto_reassign_activated_at;
    if (!activatedAt) {
      // Se não tem data de ativação, definir agora
      await pool.query(
        `update pipeline_rules_config set auto_reassign_activated_at = now() where tenant_id = $1 and pipeline_key = 'geral'`,
        [tenantId],
      );
      result.ok = true;
      return result;
    }

    // 2. Buscar leads elegíveis para reatribuição
    //    - Parados há 7+ dias DESDE a ativação
    //    - Máximo 3 reatribuições
    //    - Não em estágios finais
    //    - last_activity_at anterior à ativação = ignorar
    const staleLeads = await pool.query(
      `SELECT l.id, l.sdr_owner_id, l.stage, l.pipeline_key, l.last_activity_at, l.reassignment_count,
              c.name as contact_name,
              EXTRACT(EPOCH FROM (now() - l.last_activity_at)) / 86400.0 as days_stale
       FROM leads l
       LEFT JOIN contacts c ON c.tenant_id = l.tenant_id AND c.id = l.contact_id
       WHERE l.tenant_id = $1
         AND l.stage NOT IN ('contrato_enervita', 'perdido')
         AND l.sdr_owner_id IS NOT NULL
         AND l.reassignment_count < 3
         AND l.last_activity_at >= $2::timestamptz
         AND l.last_activity_at < now() - INTERVAL '7 days'
       ORDER BY l.last_activity_at ASC
       LIMIT 50`,
      [tenantId, activatedAt],
    );

    for (const lead of staleLeads.rows) {
      try {
        const leadId = lead.id as string;
        const fromSellerId = lead.sdr_owner_id as string;
        const daysStale = Number(lead.days_stale);
        const reassignCount = Number(lead.reassignment_count);

        // 3. Identificar serviço pelo adset_name
        let serviceKey = "random";
        const attrResult = await pool.query(
          `SELECT la.adset_name FROM lead_attributions la WHERE la.tenant_id = $1 AND la.lead_id = $2 ORDER BY la.created_at DESC LIMIT 1`,
          [tenantId, leadId],
        );
        const adsetName = (attrResult.rows[0]?.adset_name as string) ?? null;

        if (adsetName) {
          const services = await pool.query(
            `SELECT key, keywords FROM lead_routing_services WHERE tenant_id = $1 AND is_active = true`,
            [tenantId],
          );
          for (const svc of services.rows) {
            const keywords = svc.keywords as string[];
            const matched = keywords.some((kw) => adsetName.toLowerCase().includes(kw.toLowerCase()));
            if (matched) {
              serviceKey = svc.key as string;
              break;
            }
          }
        }

        // 4. Buscar melhor vendedor candidato
        const candidateQuery = `
          SELECT u.id, u.name
          FROM users u
          JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
          JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
          LEFT JOIN lead_routing_user_rules rule ON rule.tenant_id = u.tenant_id AND rule.user_id = u.id
          WHERE u.tenant_id = $1
            AND u.status = 'active'
            AND r.name IN ('sdr', 'vendedor', 'seller', 'closer')
            AND u.id != $2
            AND (
              ($3 = 'random' AND COALESCE(rule.rule_key, 'random') = 'random')
              OR ($3 != 'random' AND COALESCE(rule.rule_key, 'none') = $3)
            )
            AND NOT EXISTS (
              SELECT 1 FROM user_roles admin_ur
              JOIN roles admin_r ON admin_r.tenant_id = admin_ur.tenant_id AND admin_r.id = admin_ur.role_id
              WHERE admin_ur.tenant_id = u.tenant_id AND admin_ur.user_id = u.id AND admin_r.name = 'admin'
            )
          ORDER BY (SELECT COUNT(*) FROM leads l2 WHERE l2.tenant_id = u.tenant_id AND l2.sdr_owner_id = u.id AND l2.stage NOT IN ('contrato_enervita', 'perdido')) ASC,
                   u.name ASC
          LIMIT 1`;

        const candidateResult = await pool.query(candidateQuery, [tenantId, fromSellerId, serviceKey]);
        const candidate = candidateResult.rows[0];
        if (!candidate) {
          result.errors.push(`No candidate found for lead ${leadId} (service: ${serviceKey})`);
          continue;
        }

        const toSellerId = candidate.id as string;
        const toSellerName = candidate.name as string;
        const fromSellerName = await getUserName(pool, tenantId, fromSellerId);
        const contactName = (lead.contact_name as string) ?? "Lead";
        const newCount = reassignCount + 1;

        // 5. Executar reatribuição
        await pool.query(
          `UPDATE leads SET sdr_owner_id = $1, last_activity_at = now(), reassignment_count = $2, updated_at = now() WHERE tenant_id = $3 AND id = $4`,
          [toSellerId, newCount, tenantId, leadId],
        );

        // 6. Registrar transição
        await pool.query(
          `INSERT INTO lead_stage_transitions (tenant_id, lead_id, pipeline_key, from_stage, to_stage, direction, changed_by, notes)
           VALUES ($1, $2, $3, $4, $4, 'lateral', $5, $6)`,
          [tenantId, leadId, lead.pipeline_key, lead.stage, toSellerId, `Reatribuição automática #${newCount} - ${Math.floor(daysStale)} dias sem movimentação`],
        );

        // 7. Registrar no audit log
        await pool.query(
          `INSERT INTO audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
           VALUES ($1, $2, 'lead', $3, 'lead.auto_reassigned', $4, $5)`,
          [
            tenantId,
            toSellerId,
            leadId,
            JSON.stringify({ sdr_owner_id: fromSellerId, reassignment_count: reassignCount }),
            JSON.stringify({ sdr_owner_id: toSellerId, reassignment_count: newCount, service_key: serviceKey }),
          ],
        );

        // 8. Notificações
        // 8a. Vendedor antigo
        await createNotificationIfMissing(pool, {
          tenantId,
          userId: fromSellerId,
          leadId,
          type: "lead_reassigned_out",
          severity: "warning",
          title: `Lead ${contactName} foi reatribuído`,
          body: `O lead "${contactName}" foi reatribuído para ${toSellerName} após ${Math.floor(daysStale)} dias sem movimentação.`,
          href: `/leads/${leadId}`,
          metadata: { rule: "lead_reassigned_out", entityType: "lead", entityId: leadId, bucket, fromSellerId, toSellerId, daysStale: Math.floor(daysStale), reassignmentCount: newCount },
        });

        // 8b. Vendedor novo
        await createNotificationIfMissing(pool, {
          tenantId,
          userId: toSellerId,
          leadId,
          type: "lead_reassigned_in",
          severity: "info",
          title: `Você recebeu o lead ${contactName}`,
          body: `Lead "${contactName}" reatribuído de ${fromSellerName}. Serviço: ${serviceKey}. Reatribuição #${newCount}.`,
          href: `/leads/${leadId}`,
          metadata: { rule: "lead_reassigned_in", entityType: "lead", entityId: leadId, bucket, fromSellerId, toSellerId, serviceKey, reassignmentCount: newCount },
        });

        // 8c. Admin
        if (adminUserId) {
          await createNotificationIfMissing(pool, {
            tenantId,
            userId: adminUserId,
            leadId,
            type: "lead_reassigned_admin",
            severity: "info",
            title: `Lead ${contactName} reatribuído automaticamente`,
            body: `Lead "${contactName}" reatribuído de ${fromSellerName} para ${toSellerName} após ${Math.floor(daysStale)} dias. Serviço: ${serviceKey}. Reatribuição #${newCount}/3.`,
            href: `/leads/${leadId}`,
            metadata: { rule: "lead_reassigned_admin", entityType: "lead", entityId: leadId, bucket, fromSellerId, toSellerId, fromSellerName, toSellerName, serviceKey, daysStale: Math.floor(daysStale), reassignmentCount: newCount },
          });
        }

        result.reassignments.push({
          leadId,
          fromSeller: fromSellerId,
          fromSellerName,
          toSeller: toSellerId,
          toSellerName,
          contactName,
          serviceKey,
          reassignmentCount: newCount,
        });
      } catch (err) {
        result.errors.push(`Lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 9. Notificações de aviso (3 dias antes) - leads com 4+ dias parados
    const warningLeads = await pool.query(
      `SELECT l.id, l.sdr_owner_id, l.last_activity_at, l.reassignment_count,
              c.name as contact_name,
              EXTRACT(EPOCH FROM (now() - l.last_activity_at)) / 86400.0 as days_stale
       FROM leads l
       LEFT JOIN contacts c ON c.tenant_id = l.tenant_id AND c.id = l.contact_id
       WHERE l.tenant_id = $1
         AND l.stage NOT IN ('contrato_enervita', 'perdido')
         AND l.sdr_owner_id IS NOT NULL
         AND l.reassignment_count < 3
         AND l.last_activity_at >= $2::timestamptz
         AND l.last_activity_at < now() - INTERVAL '4 days'
         AND l.last_activity_at >= now() - INTERVAL '7 days'
       ORDER BY l.last_activity_at ASC
       LIMIT 100`,
      [tenantId, activatedAt],
    );

    let warningCount = 0;
    for (const lead of warningLeads.rows) {
      try {
        const leadId = lead.id as string;
        const sellerId = lead.sdr_owner_id as string;
        const daysStale = Number(lead.days_stale);
        const daysLeft = Math.max(0, 7 - Math.floor(daysStale));
        const contactName = (lead.contact_name as string) ?? "Lead";

        if (daysLeft > 0 && daysLeft <= 3) {
          const created = await createNotificationIfMissing(pool, {
            tenantId,
            userId: sellerId,
            leadId,
            type: "lead_reassign_warning",
            severity: daysLeft === 1 ? "error" : "warning",
            title: `Lead ${contactName} será reatribuído em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`,
            body: `O lead "${contactName}" está sem movimentação há ${Math.floor(daysStale)} dias. Se não houver atividade, será reatribuído automaticamente.`,
            href: `/leads/${leadId}`,
            metadata: { rule: "lead_reassign_warning", entityType: "lead", entityId: leadId, bucket, sellerId, daysStale: Math.floor(daysStale), daysLeft },
          });
          if (created) warningCount++;
        }
      } catch (err) {
        result.errors.push(`Warning lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    result.notifications.push({ type: "lead_reassign_warning", count: warningCount });
    result.ok = true;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  } finally {
    await pool.end();
  }
}

// Executar
try {
  const result = await runAutoReassign();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
