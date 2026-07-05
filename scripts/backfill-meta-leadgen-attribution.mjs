import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.CUSTOM_DATABASE_URL;
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'enervita';
const APPLY = process.argv.includes('--apply');
const QUIET = process.argv.includes('--quiet');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : 5000;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function attributionConfidence(attribution) {
  const hasIds = Boolean(attribution.campaignId || attribution.adsetId || attribution.adId || attribution.formId);
  const hasNames = Boolean(attribution.campaignName || attribution.adsetName || attribution.adName || attribution.formName);
  return hasIds && hasNames ? 'complete' : 'partial';
}

async function resolveMetaAttribution(db, tenantId, row) {
  const normalized = objectValue(row.normalized_payload);
  const metadata = objectValue(row.lead_metadata);
  const meta = objectValue(metadata.meta);
  const rawLeadDetails = objectValue(meta.rawLeadDetails);

  const campaignId = clean(row.campaign_id) ?? clean(normalized.campaign_id) ?? clean(metadata.campaign_id) ?? clean(rawLeadDetails.campaign_id);
  const adsetId = clean(row.adset_id) ?? clean(normalized.adset_id) ?? clean(metadata.adset_id) ?? clean(rawLeadDetails.adset_id);
  const adId = clean(row.ad_id) ?? clean(normalized.ad_id) ?? clean(metadata.ad_id) ?? clean(rawLeadDetails.ad_id);
  const formId = clean(row.form_id) ?? clean(normalized.form_id) ?? clean(metadata.form_id) ?? clean(rawLeadDetails.form_id);

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
    leadgenId: clean(row.leadgen_id) ?? clean(metadata.leadgen_id),
    formId,
    formName: clean(normalized.formName) ?? clean(meta.formName) ?? clean(rawLeadDetails.form_name),
    campaignId,
    campaignName: clean(campaignResult.rows[0]?.name) ?? clean(meta.campaignName) ?? clean(rawLeadDetails.campaign_name),
    adsetId,
    adsetName: clean(adSetResult.rows[0]?.name) ?? clean(meta.adsetName) ?? clean(rawLeadDetails.adset_name),
    adId,
    adName: clean(adResult.rows[0]?.name) ?? clean(adResult.rows[0]?.creative_name) ?? clean(meta.adName) ?? clean(rawLeadDetails.ad_name),
  };
  return {
    ...attribution,
    utmSource: 'meta',
    utmMedium: 'lead_ads',
    utmCampaign: attribution.campaignName ?? attribution.campaignId,
    utmContent: attribution.adName ?? attribution.adId,
    utmTerm: attribution.adsetName ?? attribution.adsetId,
    confidence: attributionConfidence(attribution),
  };
}

function attributionMeta(attribution, normalized) {
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
    rawFormFields: objectValue(normalized.raw_fields),
  };
}

async function persist(db, tenantId, row, attribution) {
  const normalized = objectValue(row.normalized_payload);
  const meta = attributionMeta(attribution, normalized);
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
      row.lead_id,
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
      row.event_id,
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
    [tenantId, row.lead_id, attribution.sourceChannel, attribution.utmSource, attribution.utmMedium, attribution.utmCampaign, attribution.utmContent, attribution.utmTerm, JSON.stringify(meta), JSON.stringify(topLevelMetadata)],
  );

  await db.query(
    `update contacts
        set source = case when source is null or source in ('', 'desconhecido', 'api') then $3 else source end,
            metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{meta}', coalesce(metadata->'meta', '{}'::jsonb) || $4::jsonb, true) || $5::jsonb,
            updated_at = now()
      where tenant_id = $1 and id = $2`,
    [tenantId, row.contact_id, attribution.sourceChannel, JSON.stringify(meta), JSON.stringify(topLevelMetadata)],
  );

  const payload = {
    action: 'created',
    leadId: row.lead_id,
    source: attribution.sourceChannel,
    leadEventSource: 'Enervita Custom CRM',
    meta,
    attribution: {
      campaign_id: attribution.campaignId,
      adset_id: attribution.adsetId,
      ad_id: attribution.adId,
      form_id: attribution.formId,
      leadgen_id: attribution.leadgenId,
    },
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

  const existing = await db.query(
    `select id from tracking_events
      where tenant_id = $1 and lead_id = $2 and platform = 'meta' and event_name = 'Lead'
      order by created_at asc
      limit 1`,
    [tenantId, row.lead_id],
  );
  if (existing.rows[0]) {
    await db.query(`update tracking_events set payload = coalesce(payload, '{}'::jsonb) || $3::jsonb, updated_at = now() where tenant_id = $1 and id = $2`, [tenantId, existing.rows[0].id, JSON.stringify(payload)]);
  } else {
    await db.query(
      `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
       values ($1, $2, 'meta', 'Lead', 'queued', $3::jsonb, now())`,
      [tenantId, row.lead_id, JSON.stringify(payload)],
    );
  }
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const tenantResult = await db.query('select id from tenants where slug = $1 limit 1', [TENANT_SLUG]);
    const tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) throw new Error(`Tenant not found: ${TENANT_SLUG}`);

    const result = await db.query(
      `select mle.id as event_id,
              mle.lead_id,
              mle.contact_id,
              mle.leadgen_id,
              mle.form_id,
              mle.ad_id,
              mle.adset_id,
              mle.campaign_id,
              mle.normalized_payload,
              l.metadata as lead_metadata
         from meta_leadgen_events mle
         join leads l on l.tenant_id = mle.tenant_id and l.id = mle.lead_id
        where mle.tenant_id = $1
          and mle.lead_id is not null
          and (
            not exists (
              select 1
                from lead_attributions la
               where la.tenant_id = mle.tenant_id
                 and la.lead_id = mle.lead_id
            )
            or exists (
              select 1
                from lead_attributions la
               where la.tenant_id = mle.tenant_id
                 and la.lead_id = mle.lead_id
                 and la.confidence <> 'complete'
            )
            or not exists (
              select 1
                from tracking_events te
               where te.tenant_id = mle.tenant_id
                 and te.lead_id = mle.lead_id
                 and te.platform = 'meta'
            )
          )
        order by mle.meta_created_time desc nulls last, mle.received_at desc
        limit $2`,
      [tenantId, Number.isFinite(LIMIT) && LIMIT > 0 ? LIMIT : 5000],
    );

    const summary = {
      ok: true,
      mode: APPLY ? 'apply' : 'dry-run',
      scanned: result.rows.length,
      candidates: 0,
      complete: 0,
      partial: 0,
      applied: 0,
      errors: 0,
    };

    for (const row of result.rows) {
      const attribution = await resolveMetaAttribution(db, tenantId, row);
      if (!attribution.leadgenId && !attribution.campaignId && !attribution.adsetId && !attribution.adId && !attribution.formId) continue;
      summary.candidates += 1;
      if (attribution.confidence === 'complete') summary.complete += 1;
      else summary.partial += 1;
      if (!APPLY) continue;
      try {
        await db.query('begin');
        await persist(db, tenantId, row, attribution);
        await db.query('commit');
        summary.applied += 1;
      } catch (error) {
        await db.query('rollback');
        summary.errors += 1;
        if (!QUIET) console.error(JSON.stringify({ error: error.message, eventId: row.event_id, leadId: row.lead_id }));
      }
    }

    console.log(JSON.stringify(summary));
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
