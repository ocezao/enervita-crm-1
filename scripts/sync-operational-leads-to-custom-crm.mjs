import pg from 'pg';

const { Client } = pg;

const OPERATIONAL_DATABASE_URL = process.env.OPERATIONAL_DATABASE_URL;
const CUSTOM_DATABASE_URL = process.env.CUSTOM_DATABASE_URL ?? process.env.DATABASE_URL;
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'enervita';
const OPERATIONAL_LEAD_SYNC_MIN_CREATED_AT = process.env.OPERATIONAL_LEAD_SYNC_MIN_CREATED_AT?.trim() || null;

if (!OPERATIONAL_DATABASE_URL) {
  throw new Error('OPERATIONAL_DATABASE_URL is required');
}
if (!CUSTOM_DATABASE_URL) {
  throw new Error('CUSTOM_DATABASE_URL or DATABASE_URL is required');
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStage(stage) {
  const normalized = String(stage ?? '').trim().toLowerCase();
  const map = {
    new: 'novo_lead',
    novo: 'novo_lead',
    novo_lead: 'novo_lead',
    pending: 'qualificacao',
    qualificacao: 'qualificacao',
    atendimento: 'atendimento_iniciado',
    atendimento_iniciado: 'atendimento_iniciado',
    conta_recebida: 'conta_recebida',
    diagnostico: 'diagnostico',
    proposta: 'proposta_enviada',
    proposta_enviada: 'proposta_enviada',
    contrato: 'contrato_enervita',
    contrato_enervita: 'contrato_enervita',
    perdido: 'perdido',
  };
  return map[normalized] ?? 'novo_lead';
}

function priorityFromTicket(value) {
  const ticket = Number(value ?? 0);
  if (ticket >= 120000) return 'alta';
  if (ticket >= 60000) return 'media';
  return 'baixa';
}

const META_STAGE_EVENTS = {
  novo_lead: 'Lead',
  qualificacao: 'EnervitaPreQualifiedLead',
  atendimento_iniciado: 'EnervitaOpportunity',
  conta_recebida: 'EnervitaBillReceived',
  diagnostico: 'EnervitaQualifiedLead',
  proposta_enviada: 'ProposalSent',
  contrato_enervita: 'WonLead',
  perdido: 'LeadUnqualified',
};

function attributionFromPayload(payload) {
  return objectValue(payload.attribution);
}

function consentFrom(row, payload) {
  if (typeof row.consent === 'boolean') return row.consent;
  const consent = objectValue(payload.consent);
  if (typeof consent.marketing === 'boolean') return consent.marketing;
  if (typeof consent.contact === 'boolean') return consent.contact;
  return false;
}

function metadataFrom(row) {
  const payload = objectValue(row.payload);
  const request = objectValue(payload.request);
  const attribution = attributionFromPayload(payload);
  return {
    ...payload,
    operational_lead_id: row.lead_id,
    operational_contact_id: row.contact_id,
    source_system: 'enervita_operational_db',
    sync_source: 'sync-operational-leads-to-custom-crm',
    city: text(payload.city) ?? text(payload.cidade) ?? null,
    state: text(payload.state) ?? text(payload.estado) ?? null,
    message: text(payload.message) ?? null,
    formName: text(payload.formName) ?? text(row.form_name) ?? null,
    request: {
      ...request,
      userAgent: text(request.userAgent) ?? text(row.user_agent) ?? null,
      ipHashStored: Boolean(row.ip_hash),
      rawIpStored: false,
    },
    attribution,
  };
}

function metaTrackingPayload({ row, payload, metadata, attribution, stage, priority }) {
  return {
    action: 'created',
    leadId: row.lead_id,
    stage,
    fromStage: null,
    transitionDirection: 'created',
    source: text(row.lead_source) ?? text(row.source) ?? text(row.form_name) ?? 'site',
    utm: {
      source: text(row.utm_source) ?? text(attribution.utm_source),
      medium: text(row.utm_medium) ?? text(attribution.utm_medium),
      campaign: text(row.utm_campaign) ?? text(attribution.utm_campaign) ?? text(attribution.campaign_name),
      content: text(row.utm_content) ?? text(attribution.utm_content) ?? text(attribution.ad_name),
      term: text(row.utm_term) ?? text(attribution.utm_term) ?? text(attribution.keyword),
    },
    attribution: {
      fbp: text(attribution.fbp),
      fbc: text(attribution.fbc),
      fbclid: text(attribution.fbclid),
      gclid: text(attribution.gclid),
    },
    tags: [],
    priority,
    qualificationStatus: text(row.qualification_status) ?? 'pending',
    qualification: {
      status: text(row.qualification_status) ?? 'pending',
      priority,
      estimatedTicket: numberOrNull(row.estimated_ticket),
      energyBillValue: numberOrNull(payload.energyBillValue) ?? numberOrNull(payload.billValue) ?? numberOrNull(payload.monthlyBillValue),
      averageConsumptionKwh: numberOrNull(payload.averageConsumptionKwh) ?? numberOrNull(payload.consumoMedioKwh),
      concessionaria: text(payload.concessionaria),
      offer: text(payload.offer) ?? text(payload.ofertaEnervita) ?? text(payload.oferta),
      projectedSavings: numberOrNull(payload.projectedSavings) ?? numberOrNull(payload.economiaMensalProjetada),
    },
    estimatedTicket: numberOrNull(row.estimated_ticket) ?? numberOrNull(payload.monthlyBillValue),
    actorUserId: null,
    request: metadata.request,
    location: {
      city: metadata.city,
      state: metadata.state,
      country: text(payload.country) ?? text(payload.pais) ?? 'BR',
    },
    contact: {
      name: text(row.name),
      company: text(row.company),
      source: text(row.source),
    },
    leadEventSource: 'Enervita Operational Sync',
  };
}

async function queueMetaTrackingEvent(custom, tenantId, row, payload, metadata, attribution, stage, priority) {
  const eventName = META_STAGE_EVENTS[stage];
  if (!eventName) return;
  await custom.query(
    `insert into tracking_events (tenant_id, lead_id, platform, event_name, status, payload, next_retry_at)
     values ($1, $2::uuid, 'meta', $3, 'queued', $4::jsonb, now())`,
    [tenantId, row.lead_id, eventName, JSON.stringify(metaTrackingPayload({ row, payload, metadata, attribution, stage, priority }))],
  );
}


async function resolveSdrOwnerId(custom, tenantId) {
  // Round-robin rotation: find all SDRs, check last assigned, pick next
  const sdrList = await custom.query(
    `select u.id::text as id
       from users u
       join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
       join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
      where u.tenant_id = $1
        and u.status = 'active'
        and r.name in ('sdr', 'vendedor', 'seller', 'closer')
        and not exists (
          select 1
            from user_roles admin_ur
            join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
           where admin_ur.tenant_id = u.tenant_id
             and admin_ur.user_id = u.id
             and admin_r.name = 'admin'
        )
      order by u.name`,
    [tenantId],
  );
  if (sdrList.rows.length === 0) return null;
  if (sdrList.rows.length === 1) return sdrList.rows[0].id;
  const lastLead = await custom.query(
    `select sdr_owner_id from leads where tenant_id = $1 and sdr_owner_id is not null order by created_at desc limit 1`,
    [tenantId],
  );
  const lastId = lastLead.rows[0]?.sdr_owner_id ?? null;
  const lastIdx = sdrList.rows.findIndex(r => r.id === lastId);
  const nextIdx = (lastIdx + 1) % sdrList.rows.length;
  return sdrList.rows[nextIdx].id;
}

async function main() {
  const operational = new Client({ connectionString: OPERATIONAL_DATABASE_URL });
  const custom = new Client({ connectionString: CUSTOM_DATABASE_URL });
  await operational.connect();
  await custom.connect();

  try {
    const tenantResult = await custom.query('select id from tenants where slug = $1 limit 1', [TENANT_SLUG]);
    const tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) throw new Error(`Tenant not found: ${TENANT_SLUG}`);

    const source = await operational.query(
      `select
         l.id::text as lead_id,
         l.contact_id::text as contact_id,
         c.name,
         c.email,
         c.phone,
         c.company,
         c.source,
         c.utm_source,
         c.utm_medium,
         c.utm_campaign,
         c.utm_content,
         c.utm_term,
         c.consent,
         fs.form_name,
         fs.payload,
         fs.user_agent,
         fs.ip_hash,
         l.estimated_ticket,
         l.stage,
         l.qualification_status,
         l.lead_source,
         l.notes,
         l.created_at,
         l.updated_at
       from crm_leads l
       join clients cr on cr.id = l.client_id and cr.slug = $1
       join contacts c on c.id = l.contact_id
       left join lateral (
         select * from form_submissions s where s.contact_id = c.id order by s.created_at desc limit 1
       ) fs on true
       where ($2::timestamptz is null or l.created_at >= $2::timestamptz)
       order by l.created_at asc`,
      [TENANT_SLUG, OPERATIONAL_LEAD_SYNC_MIN_CREATED_AT],
    );

    const deletedOperationalLeadIds = new Set(
      (await custom.query(
        `select distinct coalesce(before_data->'metadata'->>'operational_lead_id', entity_id::text) as operational_lead_id
           from audit_logs
          where tenant_id = $1
            and entity_type = 'lead'
            and action = 'lead.deleted'
            and coalesce(before_data->'metadata'->>'source_system', '') = 'enervita_operational_db'`,
        [tenantId],
      )).rows.map((item) => item.operational_lead_id).filter(Boolean),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let skippedDeleted = 0;

    for (const row of source.rows) {
      if (deletedOperationalLeadIds.has(row.lead_id)) {
        skippedDeleted += 1;
        continue;
      }
      const payload = objectValue(row.payload);
      const attribution = attributionFromPayload(payload);
      const metadata = metadataFrom(row);
      const contactMetadata = {
        operational_contact_id: row.contact_id,
        source_system: 'enervita_operational_db',
        city: metadata.city,
        state: metadata.state,
        fbp: text(attribution.fbp) ? 'present' : '',
        fbc: text(attribution.fbc) ? 'present' : '',
        fbclid: text(attribution.fbclid) ? 'present' : '',
        gclid: text(attribution.gclid) ? 'present' : '',
        consent: objectValue(payload.consent),
        privacy: { rawIpStored: false, ipHashStored: Boolean(row.ip_hash) },
        request: metadata.request,
      };

      const exists = await custom.query(
        `select l.id, l.contact_id as "contactId"
           from leads l
           left join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id
          where l.tenant_id = $1
            and (l.id = $2::uuid
              or l.metadata->>'operational_lead_id' = $3
              or c.metadata->>'operational_contact_id' = $4)
          limit 1`,
        [tenantId, row.lead_id, row.lead_id, row.contact_id],
      );
      if (exists.rows[0]?.id) {
        await custom.query('begin');
        try {
          await custom.query(
            `update contacts
                set name = coalesce($3, name),
                    email = coalesce($4, email),
                    phone = coalesce($5, phone),
                    company = coalesce($6, company),
                    source = coalesce($7, source),
                    consent = coalesce($8, consent),
                    metadata = metadata || $9::jsonb,
                    updated_at = greatest(updated_at, coalesce($10, updated_at))
              where tenant_id = $1 and id = $2`,
            [
              tenantId,
              exists.rows[0].contactId,
              text(row.name),
              text(row.email),
              text(row.phone),
              text(row.company) ?? text(payload.city) ?? text(payload.cidade),
              text(row.source) ?? text(row.lead_source) ?? text(row.form_name) ?? 'site',
              consentFrom(row, payload),
              JSON.stringify(contactMetadata),
              row.updated_at,
            ],
          );
          await custom.query(
            `update leads
                set qualification_status = coalesce($3, qualification_status),
                    lead_source = coalesce($4, lead_source),
                    utm_source = coalesce($5, utm_source),
                    utm_medium = coalesce($6, utm_medium),
                    utm_campaign = coalesce($7, utm_campaign),
                    utm_content = coalesce($8, utm_content),
                    utm_term = coalesce($9, utm_term),
                    fbp = coalesce($10, fbp),
                    fbc = coalesce($11, fbc),
                    fbclid = coalesce($12, fbclid),
                    gclid = coalesce($13, gclid),
                    estimated_ticket = coalesce($14, estimated_ticket),
                    notes = coalesce($15, notes),
                    metadata = metadata || $16::jsonb,
                    updated_at = greatest(updated_at, coalesce($17, updated_at))
              where tenant_id = $1 and id = $2`,
            [
              tenantId,
              exists.rows[0].id,
              text(row.qualification_status) ?? 'pending',
              text(row.lead_source) ?? text(row.source) ?? text(row.form_name) ?? 'site',
              text(row.utm_source) ?? text(attribution.utm_source),
              text(row.utm_medium) ?? text(attribution.utm_medium),
              text(row.utm_campaign) ?? text(attribution.utm_campaign) ?? text(attribution.campaign_name),
              text(row.utm_content) ?? text(attribution.utm_content) ?? text(attribution.ad_name),
              text(row.utm_term) ?? text(attribution.utm_term) ?? text(attribution.keyword),
              text(attribution.fbp),
              text(attribution.fbc),
              text(attribution.fbclid),
              text(attribution.gclid),
              numberOrNull(row.estimated_ticket) ?? numberOrNull(payload.monthlyBillValue),
              text(row.notes) ?? text(payload.message),
              JSON.stringify(metadata),
              row.updated_at,
            ],
          );
          await custom.query('commit');
          updated += 1;
        } catch (error) {
          await custom.query('rollback');
          throw error;
        }
        continue;
      }

      await custom.query('begin');
      try {
        const stage = normalizeStage(row.stage);
        const priority = priorityFromTicket(row.estimated_ticket);
        const contact = await custom.query(
          `insert into contacts (tenant_id, name, email, phone, company, source, consent, metadata, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, coalesce($10, now()))
           returning id`,
          [
            tenantId,
            text(row.name) ?? 'Lead Enervita',
            text(row.email),
            text(row.phone),
            text(row.company) ?? text(payload.city) ?? text(payload.cidade),
            text(row.source) ?? text(row.lead_source) ?? text(row.form_name) ?? 'site',
            consentFrom(row, payload),
            JSON.stringify(contactMetadata),
            row.created_at,
            row.updated_at,
          ],
        );

        const sdrOwnerId = await resolveSdrOwnerId(custom, tenantId);
        await custom.query(
          `insert into leads (
             id, tenant_id, contact_id, stage, qualification_status, lead_source,
             utm_source, utm_medium, utm_campaign, utm_content, utm_term,
             fbp, fbc, fbclid, gclid, estimated_ticket, sdr_owner_id, priority, notes, metadata, created_at, updated_at
           ) values (
             $1::uuid, $2, $3, $4::lead_stage, $5, $6,
             $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17::uuid, $18::priority_level, $19, $20::jsonb, $21, coalesce($22, now())
           )`,
          [
            row.lead_id,
            tenantId,
            contact.rows[0].id,
            stage,
            text(row.qualification_status) ?? 'pending',
            text(row.lead_source) ?? text(row.source) ?? text(row.form_name) ?? 'site',
            text(row.utm_source) ?? text(attribution.utm_source),
            text(row.utm_medium) ?? text(attribution.utm_medium),
            text(row.utm_campaign) ?? text(attribution.utm_campaign) ?? text(attribution.campaign_name),
            text(row.utm_content) ?? text(attribution.utm_content) ?? text(attribution.ad_name),
            text(row.utm_term) ?? text(attribution.utm_term) ?? text(attribution.keyword),
            text(attribution.fbp),
            text(attribution.fbc),
            text(attribution.fbclid),
            text(attribution.gclid),
            numberOrNull(row.estimated_ticket) ?? numberOrNull(payload.monthlyBillValue),
            sdrOwnerId,
            priority,
            text(row.notes) ?? text(payload.message),
            JSON.stringify(metadata),
            row.created_at,
            row.updated_at,
          ],
        );

        if (sdrOwnerId) {
          await custom.query(
            `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, after_data)
             values ($1, null, 'lead', $2, 'lead.assigned', $3::jsonb)`,
            [tenantId, row.lead_id, JSON.stringify({ sdrOwnerId, reason: 'round_robin_new_lead' })],
          );
        }
        await queueMetaTrackingEvent(custom, tenantId, row, payload, metadata, attribution, stage, priority);
        await custom.query('commit');
        inserted += 1;
      } catch (error) {
        await custom.query('rollback');
        throw error;
      }
    }

    console.log(JSON.stringify({ sourceRows: source.rowCount, inserted, updated, skipped, skippedDeleted }, null, 2));
  } finally {
    await operational.end();
    await custom.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
