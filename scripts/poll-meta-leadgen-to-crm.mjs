import https from 'node:https';
import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.CUSTOM_DATABASE_URL;
const PAGE_ACCESS_TOKEN = process.env.META_LEADGEN_PAGE_ACCESS_TOKEN ?? process.env.META_ADS_ACCESS_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0';
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'enervita';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!PAGE_ACCESS_TOKEN) throw new Error('META_LEADGEN_PAGE_ACCESS_TOKEN or META_ADS_ACCESS_TOKEN is required');
if (!PAGE_ID) throw new Error('META_PAGE_ID is required');

function graphGet(path) {
  return new Promise((resolve, reject) => {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}${path.includes('?') ? '&' : '?'}access_token=${PAGE_ACCESS_TOKEN}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const META_LEADGEN_EVENT_NAME = 'Lead';

function buildMetaLeadgenTrackingPayload(params) {
  const {
    leadId,
    stage,
    ticket,
    priority,
    monthlyBill,
    leadgenId,
    fields = {},
    city,
    state,
    email,
    phone,
    message,
  } = params ?? {};

  return {
    action: 'created',
    leadId,
    stage,
    fromStage: null,
    transitionDirection: 'created',
    source: 'meta_lead_form',
    utm: {
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
    },
    attribution: { fbp: null, fbc: null, fbclid: null, gclid: null },
    tags: [],
    priority,
    qualificationStatus: 'pending',
    qualification: {
      status: 'pending',
      estimatedTicket: ticket ? Number(ticket) : null,
      energyBillValue: monthlyBill,
      message: message ?? null,
      city,
      state,
      rawFormFields: fields,
    },
    estimatedTicket: ticket ? String(ticket) : null,
    actorUserId: null,
    leadgenId,
    request: {
      clientIpAddress: null,
      clientUserAgent: 'meta_leadgen_poll',
    },
    location: {
      city: city ?? null,
      state: state ?? null,
      country: 'BR',
    },
    contact: {
      email,
      phone,
      name: null,
      metadata: { leadgen_id: leadgenId, source: 'meta_leadgen_poll' },
    },
    leadEventSource: 'Enervita Custom CRM',
  };
}

function extractFieldData(fieldData) {
  const result = {};
  if (!Array.isArray(fieldData)) return result;
  for (const field of fieldData) {
    const name = (field.name ?? field.key ?? '').toLowerCase().trim().replace(/:$/, '').replace(/\s+/g, '_');
    const values = field.values ?? [];
    result[name] = values[0] ?? null;
  }
  return result;
}

// Map Meta form field names to our standard names
function normalizeFieldNames(fields) {
  const mapped = { ...fields };
  // Name mappings
  for (const key of Object.keys(mapped)) {
    if (key.includes('nome') && !key.includes('email') && !key.includes('usuario')) mapped._name = mapped._name ?? mapped[key];
    if (key.includes('email') || key.includes('e-mail') || key.includes('e_mail')) mapped._email = mapped._email ?? mapped[key];
    if (key.includes('whatsapp') || key.includes('telefone') || key.includes('celular') || key.includes('phone') || key.includes('ddd')) mapped._phone = mapped._phone ?? mapped[key];
    if (key.includes('cidade') || key.includes('city')) mapped._city = mapped._city ?? mapped[key];
    if (key.includes('estado') || key.includes('state') || key.includes('uf')) mapped._state = mapped._state ?? mapped[key];
    if (key.includes('energia') || key.includes('conta') || key.includes('gasto') || key.includes('bill') || key.includes('kwh')) mapped._bill = mapped._bill ?? mapped[key];
    if (key.includes('mensagem') || key.includes('message') || key.includes('observa')) mapped._message = mapped._message ?? mapped[key];
  }
  return mapped;
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    const tenantResult = await db.query('select id from tenants where slug = $1 limit 1', [TENANT_SLUG]);
    const tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) throw new Error(`Tenant not found: ${TENANT_SLUG}`);

    // 1. Get all leadgen forms from the page
    let forms;
    try {
      forms = await graphGet(`/${PAGE_ID}/leadgen_forms?fields=id,name,status`);
    } catch (error) {
      console.warn(`Could not list leadgen forms: ${error.message}. Trying ad account forms...`);
      // Fallback: try from ad account using known form IDs from existing events
      const knownForms = await db.query(
        `select distinct form_id from meta_leadgen_events where tenant_id = $1 and form_id is not null`,
        [tenantId],
      );
      forms = { data: knownForms.rows.map(r => ({ id: r.form_id, name: 'Known Form', status: 'unknown' })) };
    }

    if (!forms.data?.length) {
      console.log(JSON.stringify({ ok: true, forms: 0, fetched: 0, inserted: 0, skipped: 0, reason: 'no_forms_found' }));
      return;
    }

    // 2. Get last processed event time for each form
    const lastEvents = await db.query(
      `select form_id, max(meta_created_time) as last_time
         from meta_leadgen_events
        where tenant_id = $1
        group by form_id`,
      [tenantId],
    );
    const lastTimeByForm = Object.fromEntries(lastEvents.rows.map(r => [r.form_id, r.last_time]));

    let totalFetched = 0;
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const form of forms.data) {
      const formId = form.id;
      const lastTime = lastTimeByForm[formId];

      // Build filtering param
      let filterParam = '';
      if (lastTime) {
        const sinceEpoch = Math.floor(new Date(lastTime).getTime() / 1000) + 1;
        filterParam = `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceEpoch}}]`;
      }

      // Fetch leads from Meta
      let leadsData;
      try {
        leadsData = await graphGet(`/${formId}/leads?fields=created_time,id,ad_id,form_id,adset_id,campaign_id,field_data,custom_disclaimer_responses${filterParam}`);
      } catch (error) {
        console.warn(`Error fetching leads for form ${formId}: ${error.message}`);
        continue;
      }

      if (!leadsData.data?.length) continue;
      totalFetched += leadsData.data.length;

      // 4. Process each lead
      for (const lead of leadsData.data) {
        const leadgenId = lead.id;
        const createdTime = lead.created_time;
        const adId = lead.ad_id ?? null;
        const adsetId = lead.adset_id ?? null;
        const campaignId = lead.campaign_id ?? null;
        const fields = normalizeFieldNames(extractFieldData(lead.field_data));

        // Check if already exists
        const existing = await db.query(
          `select id from meta_leadgen_events where tenant_id = $1 and leadgen_id = $2 limit 1`,
          [tenantId, leadgenId],
        );
        if (existing.rows[0]) {
          totalSkipped += 1;
          continue;
        }

        const fullName = text(fields._name) ?? text(fields.full_name) ?? text(fields.nome_completo) ?? text(fields.nome) ?? text(fields.name) ?? 'Lead Meta sem nome';
        const email = text(fields._email) ?? text(fields.email) ?? text(fields.e_mail) ?? null;
        const phone = text(fields._phone) ?? text(fields.phone_number) ?? text(fields.telefone) ?? text(fields.celular) ?? null;
        const city = text(fields._city) ?? text(fields.city) ?? text(fields.cidade) ?? null;
        const state = text(fields._state) ?? text(fields.state) ?? text(fields.estado) ?? null;
        const message = text(fields._message) ?? text(fields.message) ?? text(fields.mensagem) ?? null;
        const monthlyBill = text(fields._bill) ?? text(fields.monthly_bill_value) ?? text(fields.valor_conta_luz) ?? text(fields.conta_energia) ?? null;

        // Insert into meta_leadgen_events
        const normalizedPayload = {
          full_name: fullName,
          email,
          phone,
          city,
          state,
          message,
          monthlyBillValue: monthlyBill,
          formName: form.name,
          ad_id: adId,
          adset_id: adsetId,
          campaign_id: campaignId,
          raw_fields: fields,
        };

        await db.query('begin');
        try {
          // Upsert into meta_leadgen_events
          const eventResult = await db.query(
            `insert into meta_leadgen_events (
               id, tenant_id, page_id, leadgen_id, form_id, ad_id, adset_id, campaign_id,
               meta_created_time, raw_webhook, raw_change, normalized_payload, status, received_at, processed_at
             ) values (
               gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
               $8, $9::jsonb, $9::jsonb, $9::jsonb, 'received', $8, now()
             )
             on conflict (tenant_id, leadgen_id) do nothing
             returning id`,
            [tenantId, PAGE_ID, leadgenId, formId, adId, adsetId, campaignId, createdTime, JSON.stringify(normalizedPayload)],
          );

          if (!eventResult.rows[0]) {
            await db.query('rollback');
            totalSkipped += 1;
            continue;
          }

          // Check if lead already exists
          const leadExists = await db.query(
            `select l.id as lead_id,
                    l.contact_id as lead_contact_id,
                    c.id as contact_id_from_match
               from leads l
               left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
              where l.tenant_id = $1
                and (l.metadata->>'leadgen_id' = $2 or (c.email = $3 and $3 is not null) or (c.phone = $4 and $4 is not null))
              limit 1`,
            [tenantId, leadgenId, email, phone],
          );

          if (leadExists.rows[0]) {
            const existingLead = leadExists.rows[0];
            const resolvedContactId = existingLead.lead_contact_id ?? existingLead.contact_id_from_match ?? null;
            await db.query(
              `update meta_leadgen_events
                  set status = 'processed',
                      lead_id = $3,
                      contact_id = $4,
                      updated_at = now()
                where tenant_id = $1 and leadgen_id = $2`,
              [tenantId, leadgenId, existingLead.lead_id, resolvedContactId],
            );
            await db.query('commit');
            totalSkipped += 1;
            continue;
          }

          // Insert contact
          // Round-robin: find all SDRs, check last assigned, pick next in rotation
          const sdrList = await db.query(
            `select u.id::text as id
               from users u
               join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
               join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
              where u.tenant_id = $1
                and u.status = 'active'
                and r.name in ('sdr', 'vendedor', 'seller', 'closer')
                and not exists (
                  select 1 from user_roles admin_ur
                  join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
                  where admin_ur.tenant_id = u.tenant_id and admin_ur.user_id = u.id and admin_r.name = 'admin'
                )
              order by u.name`,
            [tenantId],
          );
          let sdrOwnerId = null;
          if (sdrList.rows.length > 0) {
            const lastLead = await db.query(
              `select sdr_owner_id from leads where tenant_id = $1 and sdr_owner_id is not null order by created_at desc limit 1`,
              [tenantId],
            );
            const lastId = lastLead.rows[0]?.sdr_owner_id ?? null;
            const lastIdx = sdrList.rows.findIndex(r => r.id === lastId);
            const nextIdx = sdrList.rows.length === 1 ? 0 : (lastIdx + 1) % sdrList.rows.length;
            sdrOwnerId = sdrList.rows[nextIdx].id;
          }
          const contact = await db.query(
            `insert into contacts (tenant_id, name, email, phone, company, source, consent, metadata, created_at, updated_at)
             values ($1, $2, $3, $4, $5, 'meta_lead_form', true, $6::jsonb, $7, now())
             returning id`,
            [tenantId, fullName, email, phone, city, JSON.stringify({ leadgen_id: leadgenId, form_id: formId, source: 'meta_leadgen_poll' }), createdTime],
          );

          // Insert lead
          const stage = 'novo_lead';
          const ticket = monthlyBill ? Number(monthlyBill.replace(',', '.')) : null;
          const priority = ticket && ticket >= 120000 ? 'alta' : ticket && ticket >= 60000 ? 'media' : 'baixa';

          const newLead = await db.query(
            `insert into leads (
               id, tenant_id, contact_id, stage, qualification_status, lead_source,
               energy_bill_value, sdr_owner_id, priority, notes, metadata, created_at, updated_at
             ) values (
               gen_random_uuid(), $1, $2, $3::lead_stage, 'pending', 'meta_lead_form',
               $4, $5::uuid, $6::priority_level, $7, $8::jsonb, $9, now()
             )
             returning id`,
            [
              tenantId, contact.rows[0].id, stage,
              ticket ? String(ticket) : null, sdrOwnerId, priority, message,
              JSON.stringify({ leadgen_id: leadgenId, form_id: formId, ad_id: adId, campaign_id: campaignId, city, state, source: 'meta_leadgen_poll' }),
              createdTime,
            ],
          );

          if (newLead.rows[0]) {
            const leadId = newLead.rows[0].id;
            await db.query(
              `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
               values ($1, $2, 'meta', $3, 'queued', $4::jsonb, now())`,
              [
                tenantId,
                leadId,
                META_LEADGEN_EVENT_NAME,
                JSON.stringify(buildMetaLeadgenTrackingPayload({
                  leadId,
                  stage,
                  ticket,
                  priority,
                  monthlyBill,
                  leadgenId,
                  fields,
                  city,
                  state,
                  email,
                  phone,
                  message,
                })),
              ],
            );
            await db.query(
              `update meta_leadgen_events set status = 'processed', lead_id = $3, contact_id = $4, updated_at = now()
                where tenant_id = $1 and leadgen_id = $2`,
              [tenantId, leadgenId, leadId, contact.rows[0].id],
            );

            // Assign sdr
            if (sdrOwnerId) {
              await db.query(
                `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
                 values ($1, null, 'lead', $2, 'lead.created', $3::jsonb)`,
                [tenantId, newLead.rows[0].id, JSON.stringify({ sdrOwnerId, source: 'meta_leadgen_poll' })],
              );
              await db.query(
                `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
                 values ($1, null, 'lead', $2, 'lead.assigned', $3::jsonb)`,
                [tenantId, newLead.rows[0].id, JSON.stringify({ sdrOwnerId, reason: 'round_robin_new_lead' })],
              );
            }

            totalInserted += 1;
          } else {
            // Duplicate on conflict
            await db.query(
              `update meta_leadgen_events set status = 'processed', updated_at = now()
                where tenant_id = $1 and leadgen_id = $2`,
              [tenantId, leadgenId],
            );
            totalSkipped += 1;
          }

          await db.query('commit');
        } catch (error) {
          await db.query('rollback');
          await db.query(
            `update meta_leadgen_events set status = 'failed', error_message = $3, updated_at = now()
              where tenant_id = $1 and leadgen_id = $2`,
            [tenantId, leadgenId, error.message],
          ).catch(() => {});
          console.error(`Error processing lead ${leadgenId}: ${error.message}`);
        }
      }
    }

    console.log(JSON.stringify({
      ok: true,
      forms: forms.data.length,
      fetched: totalFetched,
      inserted: totalInserted,
      skipped: totalSkipped,
    }));
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
