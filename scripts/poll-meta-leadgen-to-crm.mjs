import https from 'node:https';
import pg from 'pg';
import { detectLeadRoutingServiceKey } from './lead-routing-utils.mjs';

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

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string');
  return [];
}

async function loadLeadRoutingServices(db, tenantId) {
  const result = await db.query(
    `select key, label, keywords, pipeline_key
       from lead_routing_services
      where tenant_id = $1
        and is_active = true
      order by sort_order asc, label asc`,
    [tenantId],
  );
  return result.rows.map(row => ({
    key: row.key,
    label: row.label,
    keywords: normalizeKeywords(row.keywords),
    pipelineKey: row.pipeline_key ?? 'geral',
  }));
}

async function loadLeadRoutingSettings(db, tenantId) {
  const result = await db.query(
    `select random_enabled
       from lead_routing_settings
      where tenant_id = $1`,
    [tenantId],
  );
  return { randomEnabled: result.rows[0]?.random_enabled !== false };
}

async function loadRoutingCandidates(db, tenantId, ruleKey) {
  const result = await db.query(
    `select u.id::text as id
       from lead_routing_user_rules rule
       join users u on u.tenant_id = rule.tenant_id and u.id = rule.user_id
      where rule.tenant_id = $1
        and rule.rule_key = $2
        and u.status = 'active'
        and not exists (
          select 1
            from user_roles admin_ur
            join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
           where admin_ur.tenant_id = u.tenant_id
             and admin_ur.user_id = u.id
             and admin_r.name = 'admin'
        )
      order by u.name asc, u.id asc`,
    [tenantId, ruleKey],
  );
  return result.rows;
}

async function loadPipelineCandidates(db, tenantId, pipelineKey) {
  const result = await db.query(
    `select u.id::text as id
       from lead_pipeline_user_access access
       join users u on u.tenant_id = access.tenant_id and u.id = access.user_id
      where access.tenant_id = $1
        and access.pipeline_key = $2
        and u.status = 'active'
        and not exists (
          select 1
            from user_roles admin_ur
            join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
           where admin_ur.tenant_id = u.tenant_id
             and admin_ur.user_id = u.id
             and admin_r.name = 'admin'
        )
      order by u.name asc, u.id asc`,
    [tenantId, pipelineKey],
  );
  return result.rows;
}

async function pickNextRoutingCandidate(db, tenantId, bucketKey, candidates) {
  if (candidates.length < 1) return null;
  await db.query(
    `insert into lead_routing_state (tenant_id, bucket_key, last_user_id, updated_at)
     values ($1, $2, null, now())
     on conflict (tenant_id, bucket_key) do nothing`,
    [tenantId, bucketKey],
  );
  const state = await db.query(
    `select last_user_id::text as last_user_id
       from lead_routing_state
      where tenant_id = $1 and bucket_key = $2
      for update`,
    [tenantId, bucketKey],
  );
  const lastId = state.rows[0]?.last_user_id ?? null;
  const lastIdx = candidates.findIndex(candidate => candidate.id === lastId);
  const nextIdx = candidates.length === 1 ? 0 : (lastIdx + 1) % candidates.length;
  const selected = candidates[nextIdx];
  await db.query(
    `update lead_routing_state
        set last_user_id = $3::uuid,
            updated_at = now()
      where tenant_id = $1 and bucket_key = $2`,
    [tenantId, bucketKey, selected.id],
  );
  return selected.id;
}

async function resolveLeadRoutingOwner(db, tenantId, attribution, fields) {
  const services = await loadLeadRoutingServices(db, tenantId);
  const serviceKey = detectLeadRoutingServiceKey(services, attribution, fields);
  const service = services.find(item => item.key === serviceKey) ?? null;
  const pipelineKey = service?.pipelineKey ?? 'geral';

  if (serviceKey && pipelineKey !== 'geral') {
    const serviceCandidates = await loadPipelineCandidates(db, tenantId, pipelineKey);
    const ownerId = await pickNextRoutingCandidate(db, tenantId, `pipeline:${pipelineKey}`, serviceCandidates);
    if (ownerId) return { ownerId, reason: `pipeline_${pipelineKey}`, serviceKey, pipelineKey, pipelineStageKey: 'novo_lead', bucketKey: `pipeline:${pipelineKey}` };
  }

  const settings = await loadLeadRoutingSettings(db, tenantId);
  if (!settings.randomEnabled) {
    return { ownerId: null, reason: serviceKey ? `service_${serviceKey}_no_candidate_random_disabled` : 'random_disabled', serviceKey, pipelineKey: 'geral', pipelineStageKey: 'novo_lead', bucketKey: null };
  }

  const randomCandidates = await loadRoutingCandidates(db, tenantId, 'random');
  const ownerId = await pickNextRoutingCandidate(db, tenantId, 'random', randomCandidates);
  return {
    ownerId,
    reason: ownerId ? 'random_cycle' : (serviceKey ? `service_${serviceKey}_no_candidate` : 'random_no_candidate'),
    serviceKey,
    pipelineKey: 'geral',
    pipelineStageKey: 'novo_lead',
    bucketKey: ownerId ? 'random' : null,
  };
}

function hasAnyName(attribution) {
  return Boolean(attribution.formName || attribution.campaignName || attribution.adsetName || attribution.adName);
}

function attributionConfidence(attribution) {
  return attribution.campaignId && attribution.adsetId && attribution.adId && hasAnyName(attribution) ? 'complete' : 'partial';
}

async function resolveMetaAttribution(db, tenantId, params) {
  const campaignId = clean(params.campaignId);
  const adsetId = clean(params.adsetId);
  const adId = clean(params.adId);
  const formId = clean(params.formId);
  const formName = clean(params.formName);

  const campaignResult = campaignId
    ? await db.query(`select name from ad_campaigns where tenant_id = $1 and platform = 'meta' and external_campaign_id = $2 order by last_seen_at desc nulls last limit 1`, [tenantId, campaignId])
    : { rows: [] };
  const adSetResult = adsetId
    ? await db.query(`select name from ad_sets where tenant_id = $1 and platform = 'meta' and external_ad_set_id = $2 order by last_seen_at desc nulls last limit 1`, [tenantId, adsetId])
    : { rows: [] };
  const adResult = adId
    ? await db.query(`select name, creative_name from ads where tenant_id = $1 and platform = 'meta' and external_ad_id = $2 order by last_seen_at desc nulls last limit 1`, [tenantId, adId])
    : { rows: [] };

  const attribution = {
    sourceSystem: 'meta',
    sourceChannel: 'meta_lead_form',
    leadgenId: clean(params.leadgenId),
    formId,
    formName,
    campaignId,
    campaignName: clean(campaignResult.rows[0]?.name) ?? null,
    adsetId,
    adsetName: clean(adSetResult.rows[0]?.name) ?? null,
    adId,
    adName: clean(adResult.rows[0]?.name) ?? clean(adResult.rows[0]?.creative_name) ?? null,
    utmSource: 'meta',
    utmMedium: 'lead_ads',
    utmCampaign: clean(campaignResult.rows[0]?.name) ?? campaignId,
    utmContent: clean(adResult.rows[0]?.name) ?? clean(adResult.rows[0]?.creative_name) ?? adId,
    utmTerm: clean(adSetResult.rows[0]?.name) ?? adsetId,
  };
  return { ...attribution, confidence: attributionConfidence(attribution) };
}

function attributionMeta(attribution, fields) {
  return {
    sourceSystem: attribution.sourceSystem,
    sourceChannel: attribution.sourceChannel,
    leadgenId: attribution.leadgenId,
    formId: attribution.formId,
    formName: attribution.formName,
    campaignId: attribution.campaignId,
    campaignName: attribution.campaignName,
    adsetId: attribution.adsetId,
    adsetName: attribution.adsetName,
    adId: attribution.adId,
    adName: attribution.adName,
    confidence: attribution.confidence,
    rawLeadDetails: {
      leadgen_id: attribution.leadgenId,
      form_id: attribution.formId,
      form_name: attribution.formName,
      campaign_id: attribution.campaignId,
      campaign_name: attribution.campaignName,
      adset_id: attribution.adsetId,
      adset_name: attribution.adsetName,
      ad_id: attribution.adId,
      ad_name: attribution.adName,
    },
    rawFormFields: fields,
  };
}

async function persistLeadAttribution(db, tenantId, leadId, contactId, attribution, fields, rawEventId = null) {
  const meta = attributionMeta(attribution, fields);
  const topLevelMetadata = {
    source: attribution.sourceChannel,
    leadgen_id: attribution.leadgenId,
    form_id: attribution.formId,
    formName: attribution.formName,
    campaign_id: attribution.campaignId,
    adset_id: attribution.adsetId,
    ad_id: attribution.adId,
  };

  await db.query(
    `insert into lead_attributions (
       tenant_id, lead_id, source_system, source_channel, leadgen_id, form_id, form_name,
       campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term, raw_event_id, confidence, metadata
     ) values (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18, $19::uuid, $20, $21::jsonb
     )
     on conflict (tenant_id, lead_id) do update set
       source_system = excluded.source_system,
       source_channel = excluded.source_channel,
       leadgen_id = coalesce(excluded.leadgen_id, lead_attributions.leadgen_id),
       form_id = coalesce(excluded.form_id, lead_attributions.form_id),
       form_name = coalesce(excluded.form_name, lead_attributions.form_name),
       campaign_id = coalesce(excluded.campaign_id, lead_attributions.campaign_id),
       campaign_name = coalesce(excluded.campaign_name, lead_attributions.campaign_name),
       adset_id = coalesce(excluded.adset_id, lead_attributions.adset_id),
       adset_name = coalesce(excluded.adset_name, lead_attributions.adset_name),
       ad_id = coalesce(excluded.ad_id, lead_attributions.ad_id),
       ad_name = coalesce(excluded.ad_name, lead_attributions.ad_name),
       utm_source = coalesce(excluded.utm_source, lead_attributions.utm_source),
       utm_medium = coalesce(excluded.utm_medium, lead_attributions.utm_medium),
       utm_campaign = coalesce(excluded.utm_campaign, lead_attributions.utm_campaign),
       utm_content = coalesce(excluded.utm_content, lead_attributions.utm_content),
       utm_term = coalesce(excluded.utm_term, lead_attributions.utm_term),
       raw_event_id = coalesce(excluded.raw_event_id, lead_attributions.raw_event_id),
       confidence = case when excluded.confidence = 'complete' then excluded.confidence else lead_attributions.confidence end,
       metadata = lead_attributions.metadata || excluded.metadata,
       last_reconciled_at = now(),
       updated_at = now()`,
    [
      tenantId,
      leadId,
      attribution.sourceSystem,
      attribution.sourceChannel,
      attribution.leadgenId,
      attribution.formId,
      attribution.formName,
      attribution.campaignId,
      attribution.campaignName,
      attribution.adsetId,
      attribution.adsetName,
      attribution.adId,
      attribution.adName,
      attribution.utmSource,
      attribution.utmMedium,
      attribution.utmCampaign,
      attribution.utmContent,
      attribution.utmTerm,
      rawEventId,
      attribution.confidence,
      JSON.stringify(meta),
    ],
  );

  await db.query(
    `update leads
        set lead_source = case when lead_source is null or lead_source in ('', 'desconhecido', 'api') then $3 else lead_source end,
            utm_source = coalesce(utm_source, $4),
            utm_medium = coalesce(utm_medium, $5),
            utm_campaign = coalesce(utm_campaign, $6),
            utm_content = coalesce(utm_content, $7),
            utm_term = coalesce(utm_term, $8),
            metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{meta}', coalesce(metadata->'meta', '{}'::jsonb) || $9::jsonb, true) || $10::jsonb,
            updated_at = now()
      where tenant_id = $1 and id = $2`,
    [
      tenantId,
      leadId,
      attribution.sourceChannel,
      attribution.utmSource,
      attribution.utmMedium,
      attribution.utmCampaign,
      attribution.utmContent,
      attribution.utmTerm,
      JSON.stringify(meta),
      JSON.stringify(topLevelMetadata),
    ],
  );

  if (contactId) {
    await db.query(
      `update contacts
          set source = case when source is null or source in ('', 'desconhecido', 'api') then $3 else source end,
              metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{meta}', coalesce(metadata->'meta', '{}'::jsonb) || $4::jsonb, true) || $5::jsonb,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [tenantId, contactId, attribution.sourceChannel, JSON.stringify(meta), JSON.stringify(topLevelMetadata)],
    );
  }
}

function trackingPayloadForAttribution(base, attribution) {
  return {
    ...base,
    source: attribution.sourceChannel,
    leadEventSource: 'Enervita Custom CRM',
    attribution: {
      ...(base.attribution ?? {}),
      campaign_id: attribution.campaignId,
      adset_id: attribution.adsetId,
      ad_id: attribution.adId,
      form_id: attribution.formId,
      leadgen_id: attribution.leadgenId,
    },
    meta: attributionMeta(attribution, base.qualification?.rawFormFields ?? {}),
    campaignName: attribution.campaignName,
    adsetName: attribution.adsetName,
    adName: attribution.adName,
    formName: attribution.formName,
    campaign: { id: attribution.campaignId, name: attribution.campaignName },
    adset: { id: attribution.adsetId, name: attribution.adsetName },
    ad: { id: attribution.adId, name: attribution.adName },
    form: { id: attribution.formId, name: attribution.formName },
    utm: {
      source: attribution.utmSource,
      medium: attribution.utmMedium,
      campaign: attribution.utmCampaign,
      content: attribution.utmContent,
      term: attribution.utmTerm,
    },
  };
}

async function upsertMetaLeadTrackingEvent(db, tenantId, leadId, payload) {
  const existing = await db.query(
    `select id, payload from tracking_events
      where tenant_id = $1 and lead_id = $2 and platform = 'meta' and event_name = $3
      order by created_at asc
      limit 1`,
    [tenantId, leadId, META_LEADGEN_EVENT_NAME],
  );
  if (existing.rows[0]) {
    await db.query(
      `update tracking_events
          set payload = coalesce(payload, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [tenantId, existing.rows[0].id, JSON.stringify(payload)],
    );
    return existing.rows[0].id;
  }
  const inserted = await db.query(
    `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
     values ($1, $2, 'meta', $3, 'queued', $4::jsonb, now())
     returning id`,
    [tenantId, leadId, META_LEADGEN_EVENT_NAME, JSON.stringify(payload)],
  );
  return inserted.rows[0]?.id ?? null;
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
        const attribution = await resolveMetaAttribution(db, tenantId, {
          leadgenId,
          formId,
          formName: form.name,
          campaignId,
          adsetId,
          adId,
        });

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
            const basePayload = buildMetaLeadgenTrackingPayload({
              leadId: existingLead.lead_id,
              stage: 'novo_lead',
              ticket: null,
              priority: null,
              monthlyBill,
              leadgenId,
              fields,
              city,
              state,
              email,
              phone,
              message,
            });
            const trackingPayload = trackingPayloadForAttribution(basePayload, attribution);
            const trackingEventId = await upsertMetaLeadTrackingEvent(db, tenantId, existingLead.lead_id, trackingPayload);
            await persistLeadAttribution(db, tenantId, existingLead.lead_id, resolvedContactId, attribution, fields, eventResult.rows[0].id);
            await db.query(
              `update meta_leadgen_events
                  set status = 'processed',
                      lead_id = $3,
                      contact_id = $4,
                      normalized_payload = normalized_payload || $5::jsonb,
                      updated_at = now()
                where tenant_id = $1 and leadgen_id = $2`,
              [tenantId, leadgenId, existingLead.lead_id, resolvedContactId, JSON.stringify({ attribution, tracking_event_id: trackingEventId })],
            );
            await db.query('commit');
            totalSkipped += 1;
            continue;
          }

          const sdrRouting = await resolveLeadRoutingOwner(db, tenantId, attribution, fields);
          const sdrOwnerId = sdrRouting.ownerId;

          // Insert contact
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
               id, tenant_id, contact_id, stage, pipeline_key, pipeline_stage_key, qualification_status, lead_source,
               energy_bill_value, sdr_owner_id, priority, notes, metadata, created_at, updated_at
             ) values (
               gen_random_uuid(), $1, $2, $3::lead_stage, $4, $5, 'pending', 'meta_lead_form',
               $6, $7::uuid, $8::priority_level, $9, $10::jsonb, $11, now()
             )
             returning id`,
            [
              tenantId, contact.rows[0].id, stage, sdrRouting.pipelineKey ?? 'geral', sdrRouting.pipelineStageKey ?? 'novo_lead',
              ticket ? String(ticket) : null, sdrOwnerId, priority, message,
              JSON.stringify({ leadgen_id: leadgenId, form_id: formId, ad_id: adId, adset_id: adsetId, campaign_id: campaignId, city, state, source: 'meta_leadgen_poll', routing: sdrRouting, meta: attributionMeta(attribution, fields) }),
              createdTime,
            ],
          );

          if (newLead.rows[0]) {
            const leadId = newLead.rows[0].id;
            const basePayload = buildMetaLeadgenTrackingPayload({
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
            });
            const trackingPayload = trackingPayloadForAttribution(basePayload, attribution);
            const trackingEventId = await upsertMetaLeadTrackingEvent(db, tenantId, leadId, trackingPayload);
            await persistLeadAttribution(db, tenantId, leadId, contact.rows[0].id, attribution, fields, eventResult.rows[0].id);
            await db.query(
              `update meta_leadgen_events
                  set status = 'processed',
                      lead_id = $3,
                      contact_id = $4,
                      normalized_payload = normalized_payload || $5::jsonb,
                      updated_at = now()
                where tenant_id = $1 and leadgen_id = $2`,
              [tenantId, leadgenId, leadId, contact.rows[0].id, JSON.stringify({ attribution, tracking_event_id: trackingEventId })],
            );

            // Assign sdr
            if (sdrOwnerId) {
              await db.query(
                `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
                 values ($1, null, 'lead', $2, 'lead.created', $3::jsonb)`,
                [tenantId, newLead.rows[0].id, JSON.stringify({ sdrOwnerId, source: 'meta_leadgen_poll', routing: sdrRouting })],
              );
              await db.query(
                `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
                 values ($1, null, 'lead', $2, 'lead.assigned', $3::jsonb)`,
                [tenantId, newLead.rows[0].id, JSON.stringify({ sdrOwnerId, reason: sdrRouting.reason, serviceKey: sdrRouting.serviceKey, bucketKey: sdrRouting.bucketKey })],
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
