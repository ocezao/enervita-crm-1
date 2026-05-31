import pg from 'pg';
import type { PipelineStageKey } from '@enervita/shared';

const { Pool } = pg;

export type AnalyticsFilters = { days?: number; period?: string; startDate?: string; endDate?: string; source?: string; campaign?: string; stage?: PipelineStageKey };
export type AnalyticsKpi = { key: string; label: string; value: number; displayValue: string; helper: string; tone: 'green' | 'orange' | 'blue' | 'red' | 'slate' };
export type AnalyticsDailyPoint = { date: string; leads: number; trackedLeads: number; proposals: number; won: number; trackingEvents: number };
export type AnalyticsFunnelStep = { key: PipelineStageKey; label: string; value: number; rateFromPrevious: number | null };
export type AnalyticsTrafficSource = { source: string; label: string; leads: number; trackedLeads: number; proposals: number; won: number; estimatedTicket: number; conversionRate: number };
export type AnalyticsCampaign = { campaign: string; source: string; medium: string; leads: number; trackedLeads: number; proposals: number; won: number; estimatedTicket: number; conversionRate: number };
export type AnalyticsSignal = { key: string; label: string; count: number; coverageRate: number };
export type AnalyticsTrackingStatus = { platform: string; sent: number; queued: number; failed: number; total: number; lastSentAt: string | null };
export type AnalyticsEventName = { eventName: string; platform: string; count: number; lastSeenAt: string | null };
export type AnalyticsRecentLead = { id: string; name: string; stage: PipelineStageKey; source: string; campaign: string; signals: string[]; createdAt: string };
export type CrmAnalyticsOverview = { filters: { days: number; period?: string; startDate: string; endDate: string; source?: string; campaign?: string; stage?: PipelineStageKey }; generatedAt: string; kpis: AnalyticsKpi[]; daily: AnalyticsDailyPoint[]; funnel: AnalyticsFunnelStep[]; trafficSources: AnalyticsTrafficSource[]; campaigns: AnalyticsCampaign[]; signals: AnalyticsSignal[]; trackingStatus: AnalyticsTrackingStatus[]; eventNames: AnalyticsEventName[]; recentLeads: AnalyticsRecentLead[]; notes: string[] };
export type AnalyticsRepository = { getOverview(tenantId: string, allowedStages: PipelineStageKey[] | null, filters?: AnalyticsFilters): Promise<CrmAnalyticsOverview>; close?(): Promise<void> };

type QueryValue = string | number | string[];
const STAGE_LABELS: Record<PipelineStageKey, string> = { novo_lead: 'Novo lead', qualificacao: 'Qualificação', atendimento_iniciado: 'Atendimento iniciado', conta_recebida: 'Conta recebida', diagnostico: 'Diagnóstico', proposta_enviada: 'Proposta enviada', contrato_enervita: 'Contrato Enervita', perdido: 'Perdido' };
const FUNNEL_ORDER: PipelineStageKey[] = ['novo_lead', 'qualificacao', 'atendimento_iniciado', 'conta_recebida', 'diagnostico', 'proposta_enviada', 'contrato_enervita', 'perdido'];

function asNumber(value: unknown): number { return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || 0 : 0; }
function pct(part: number, total: number): number { return total <= 0 ? 0 : Math.round((part / total) * 1000) / 10; }
function compactNumber(value: number): string { return new Intl.NumberFormat('pt-BR', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value); }
function money(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value); }
function rateDisplay(value: number): string { return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`; }
function clean(value: string | undefined): string | undefined { const trimmed = value?.trim(); return trimmed ? trimmed : undefined; }
function sourceLabel(raw: string): string { const source = raw.trim().toLowerCase(); if (!source || source === 'desconhecido' || source === 'direct') return 'Direto ou não identificado'; if (['meta','facebook','instagram','fb','ig'].includes(source)) return 'Meta ou Instagram'; if (['google','google_ads'].includes(source)) return 'Google'; if (source.includes('whatsapp')) return 'WhatsApp'; if (source.includes('organic') || source.includes('seo')) return 'Orgânico'; return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }

type AnalyticsRange = { days: number; startDate: string; endDate: string; period: string };

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function rangeFromFilters(filters: AnalyticsFilters): AnalyticsRange {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const customStart = parseIsoDate(filters.startDate);
  const customEnd = parseIsoDate(filters.endDate);
  if (customStart && customEnd) {
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    const days = Math.max(1, Math.min(731, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1));
    return { days, startDate: isoDate(start), endDate: isoDate(end), period: filters.period ?? 'custom' };
  }
  const days = Math.max(1, Math.min(365, Math.trunc(filters.days ?? 30)));
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (days - 1));
  return { days, startDate: isoDate(start), endDate: isoDate(today), period: filters.period ?? `last_${days}_days` };
}

function buildWhere(tenantId: string, range: AnalyticsRange, allowedStages: PipelineStageKey[] | null, filters: AnalyticsFilters): { clause: string; params: QueryValue[]; empty: boolean } {
  const params: QueryValue[] = [tenantId, range.startDate, range.endDate];
  const clauses = ['l.tenant_id = $1', "l.created_at >= $2::date", "l.created_at < ($3::date + interval '1 day')"];
  if (allowedStages !== null) {
    const scoped = filters.stage ? allowedStages.filter((stage) => stage === filters.stage) : allowedStages;
    if (scoped.length === 0) return { clause: 'false', params, empty: true };
    params.push(scoped);
    clauses.push(`l.stage = any($${params.length}::lead_stage[])`);
  } else if (filters.stage) {
    params.push(filters.stage);
    clauses.push(`l.stage = $${params.length}::lead_stage`);
  }
  const source = clean(filters.source);
  if (source) { params.push(source.toLowerCase()); clauses.push(`lower(coalesce(l.utm_source, l.lead_source, '')) = $${params.length}`); }
  const campaign = clean(filters.campaign);
  if (campaign) { params.push(campaign.toLowerCase()); clauses.push(`lower(coalesce(l.utm_campaign, '')) = $${params.length}`); }
  return { clause: clauses.join(' and '), params, empty: false };
}

function emptyOverview(range: AnalyticsRange, filters: AnalyticsFilters, note = 'Nenhum dado encontrado para os filtros atuais.'): CrmAnalyticsOverview {
  return { filters: { days: range.days, period: range.period, startDate: range.startDate, endDate: range.endDate, source: filters.source, campaign: filters.campaign, stage: filters.stage }, generatedAt: new Date().toISOString(), kpis: [], daily: [], funnel: FUNNEL_ORDER.map((stage) => ({ key: stage, label: STAGE_LABELS[stage], value: 0, rateFromPrevious: null })), trafficSources: [], campaigns: [], signals: [], trackingStatus: [], eventNames: [], recentLeads: [], notes: [note] };
}

export function createStaticAnalyticsRepository(): AnalyticsRepository { return { async getOverview(_tenantId, _allowedStages, filters = {}) { return emptyOverview(rangeFromFilters(filters), filters); } }; }

export function createPgAnalyticsRepository(databaseUrl: string): AnalyticsRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    async getOverview(tenantId, allowedStages, filters = {}) {
      const range = rangeFromFilters(filters);
      const where = buildWhere(tenantId, range, allowedStages, filters);
      if (where.empty) return emptyOverview(range, filters, 'Usuário sem acesso às etapas selecionadas.');
      const trackedExpr = "l.utm_source is not null or l.utm_medium is not null or l.utm_campaign is not null or l.utm_content is not null or l.fbp is not null or l.fbc is not null or l.fbclid is not null or l.gclid is not null";
      const [summary, daily, funnel, sources, campaigns, signals, trackingStatus, eventNames, recentLeads] = await Promise.all([
        pool.query(`select count(*)::int as total_leads, count(*) filter (where ${trackedExpr})::int as tracked_leads, count(distinct p.id) filter (where p.status in ('sent','accepted'))::int as proposals_sent, count(distinct l.id) filter (where l.stage = 'contrato_enervita')::int as won_leads, coalesce(sum(l.estimated_ticket), 0) as estimated_pipeline, coalesce(avg(nullif(l.energy_bill_value, 0)), 0) as avg_bill, count(distinct te.id)::int as tracking_events from leads l left join proposals p on p.tenant_id = l.tenant_id and p.lead_id = l.id left join tracking_events te on te.tenant_id = l.tenant_id and te.lead_id = l.id where ${where.clause}`, where.params),
        pool.query(`with days as (select generate_series($2::date, $3::date, interval '1 day')::date as day), lead_daily as (select l.created_at::date as day, count(*)::int as leads, count(*) filter (where ${trackedExpr})::int as tracked_leads, count(*) filter (where l.stage = 'contrato_enervita')::int as won from leads l where ${where.clause} group by l.created_at::date), proposal_daily as (select p.created_at::date as day, count(distinct p.id)::int as proposals from proposals p join leads l on l.tenant_id = p.tenant_id and l.id = p.lead_id where ${where.clause} and p.status in ('sent','accepted') group by p.created_at::date), event_daily as (select te.created_at::date as day, count(*)::int as tracking_events from tracking_events te join leads l on l.tenant_id = te.tenant_id and l.id = te.lead_id where ${where.clause} group by te.created_at::date) select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(ld.leads, 0)::int as leads, coalesce(ld.tracked_leads, 0)::int as tracked_leads, coalesce(pd.proposals, 0)::int as proposals, coalesce(ld.won, 0)::int as won, coalesce(ed.tracking_events, 0)::int as tracking_events from days d left join lead_daily ld on ld.day = d.day left join proposal_daily pd on pd.day = d.day left join event_daily ed on ed.day = d.day order by d.day`, where.params),
        pool.query(`select l.stage::text as stage, count(*)::int as count from leads l where ${where.clause} group by l.stage`, where.params),
        pool.query(`select coalesce(nullif(l.utm_source, ''), nullif(l.lead_source, ''), 'desconhecido') as source, count(*)::int as leads, count(*) filter (where ${trackedExpr})::int as tracked_leads, count(distinct p.id) filter (where p.status in ('sent','accepted'))::int as proposals, count(distinct l.id) filter (where l.stage = 'contrato_enervita')::int as won, coalesce(sum(l.estimated_ticket), 0) as estimated_ticket from leads l left join proposals p on p.tenant_id = l.tenant_id and p.lead_id = l.id where ${where.clause} group by 1 order by leads desc, tracked_leads desc, source asc limit 12`, where.params),
        pool.query(`select coalesce(nullif(l.utm_campaign, ''), 'sem_campaign') as campaign, coalesce(nullif(l.utm_source, ''), nullif(l.lead_source, ''), 'desconhecido') as source, coalesce(nullif(l.utm_medium, ''), 'sem_medium') as medium, count(*)::int as leads, count(*) filter (where ${trackedExpr})::int as tracked_leads, count(distinct p.id) filter (where p.status in ('sent','accepted'))::int as proposals, count(distinct l.id) filter (where l.stage = 'contrato_enervita')::int as won, coalesce(sum(l.estimated_ticket), 0) as estimated_ticket from leads l left join proposals p on p.tenant_id = l.tenant_id and p.lead_id = l.id where ${where.clause} group by 1, 2, 3 order by tracked_leads desc, leads desc, campaign asc limit 12`, where.params),
        pool.query(`select key, count from (select 'utm_source' as key, count(*) filter (where l.utm_source is not null and l.utm_source <> '')::int as count from leads l where ${where.clause} union all select 'utm_campaign', count(*) filter (where l.utm_campaign is not null and l.utm_campaign <> '')::int from leads l where ${where.clause} union all select 'fbp', count(*) filter (where l.fbp is not null and l.fbp <> '')::int from leads l where ${where.clause} union all select 'fbc_fbclid', count(*) filter (where (l.fbc is not null and l.fbc <> '') or (l.fbclid is not null and l.fbclid <> ''))::int from leads l where ${where.clause} union all select 'gclid', count(*) filter (where l.gclid is not null and l.gclid <> '')::int from leads l where ${where.clause}) s`, where.params),
        pool.query(`select coalesce(nullif(te.platform, ''), 'unknown') as platform, count(*) filter (where te.status = 'sent')::int as sent, count(*) filter (where te.status = 'queued')::int as queued, count(*) filter (where te.status = 'failed')::int as failed, count(*)::int as total, max(te.sent_at)::text as last_sent_at from tracking_events te join leads l on l.tenant_id = te.tenant_id and l.id = te.lead_id where ${where.clause} group by 1 order by total desc, platform asc`, where.params),
        pool.query(`select te.event_name, coalesce(nullif(te.platform, ''), 'unknown') as platform, count(*)::int as count, max(te.created_at)::text as last_seen_at from tracking_events te join leads l on l.tenant_id = te.tenant_id and l.id = te.lead_id where ${where.clause} group by te.event_name, 2 order by count desc, last_seen_at desc limit 12`, where.params),
        pool.query(`select l.id::text, coalesce(nullif(c.name, ''), 'Lead sem nome') as name, l.stage::text as stage, coalesce(nullif(l.utm_source, ''), nullif(l.lead_source, ''), 'desconhecido') as source, coalesce(nullif(l.utm_campaign, ''), 'sem campaign') as campaign, l.fbp, l.fbc, l.fbclid, l.gclid, l.utm_source, l.utm_medium, l.utm_campaign, l.created_at::text from leads l join contacts c on c.tenant_id = l.tenant_id and c.id = l.contact_id where ${where.clause} order by l.created_at desc limit 10`, where.params),
      ]);
      const row = summary.rows[0] as Record<string, unknown> | undefined;
      const totalLeads = asNumber(row?.total_leads); const trackedLeads = asNumber(row?.tracked_leads); const proposalsSent = asNumber(row?.proposals_sent); const wonLeads = asNumber(row?.won_leads); const trackingEvents = asNumber(row?.tracking_events); const estimatedPipeline = asNumber(row?.estimated_pipeline); const avgBill = asNumber(row?.avg_bill);
      const stageCounts = new Map(funnel.rows.map((item) => [item.stage as PipelineStageKey, asNumber(item.count)]));
      const signalLabels: Record<string, string> = { utm_source: 'UTM source', utm_campaign: 'UTM campaign', fbp: 'fbp browser id', fbc_fbclid: 'fbc ou fbclid', gclid: 'gclid Google' };
      return { filters: { days: range.days, period: range.period, startDate: range.startDate, endDate: range.endDate, source: filters.source, campaign: filters.campaign, stage: filters.stage }, generatedAt: new Date().toISOString(), kpis: [ { key: 'totalLeads', label: 'Leads capturados', value: totalLeads, displayValue: compactNumber(totalLeads), helper: 'Leads reais criados no CRM no período', tone: 'blue' }, { key: 'trackedLeads', label: 'Leads com rastreio', value: trackedLeads, displayValue: `${compactNumber(trackedLeads)} / ${rateDisplay(pct(trackedLeads, totalLeads))}`, helper: 'UTM, fbp, fbc, fbclid ou gclid preservados', tone: 'green' }, { key: 'proposalRate', label: 'Taxa até proposta', value: pct(proposalsSent, totalLeads), displayValue: rateDisplay(pct(proposalsSent, totalLeads)), helper: 'Propostas enviadas ou aceitas sobre leads', tone: 'orange' }, { key: 'wonRate', label: 'Conversão contrato', value: pct(wonLeads, totalLeads), displayValue: rateDisplay(pct(wonLeads, totalLeads)), helper: 'Leads na etapa Contrato Enervita', tone: 'green' }, { key: 'estimatedPipeline', label: 'Pipeline estimado', value: estimatedPipeline, displayValue: money(estimatedPipeline), helper: 'Soma do ticket estimado dos leads filtrados', tone: 'slate' }, { key: 'trackingEvents', label: 'Eventos CRM', value: trackingEvents, displayValue: compactNumber(trackingEvents), helper: 'Eventos gerados em tracking_events por etapa/qualificação; status mostra fila ou envio', tone: trackingEvents > 0 ? 'green' : 'red' }, { key: 'avgBill', label: 'Conta média', value: avgBill, displayValue: money(avgBill), helper: 'Média da conta de energia informada', tone: 'orange' } ], daily: daily.rows.map((item) => ({ date: String(item.day), leads: asNumber(item.leads), trackedLeads: asNumber(item.tracked_leads), proposals: asNumber(item.proposals), won: asNumber(item.won), trackingEvents: asNumber(item.tracking_events) })), funnel: FUNNEL_ORDER.map((stage, index) => { const value = stageCounts.get(stage) ?? 0; const previous = index === 0 ? 0 : stageCounts.get(FUNNEL_ORDER[index - 1]) ?? 0; return { key: stage, label: STAGE_LABELS[stage], value, rateFromPrevious: index === 0 ? null : pct(value, previous) }; }), trafficSources: sources.rows.map((item) => { const leads = asNumber(item.leads); const won = asNumber(item.won); return { source: String(item.source), label: sourceLabel(String(item.source)), leads, trackedLeads: asNumber(item.tracked_leads), proposals: asNumber(item.proposals), won, estimatedTicket: asNumber(item.estimated_ticket), conversionRate: pct(won, leads) }; }), campaigns: campaigns.rows.map((item) => { const leads = asNumber(item.leads); const won = asNumber(item.won); return { campaign: String(item.campaign), source: String(item.source), medium: String(item.medium), leads, trackedLeads: asNumber(item.tracked_leads), proposals: asNumber(item.proposals), won, estimatedTicket: asNumber(item.estimated_ticket), conversionRate: pct(won, leads) }; }), signals: signals.rows.map((item) => ({ key: String(item.key), label: signalLabels[String(item.key)] ?? String(item.key), count: asNumber(item.count), coverageRate: pct(asNumber(item.count), totalLeads) })), trackingStatus: trackingStatus.rows.map((item) => ({ platform: String(item.platform), sent: asNumber(item.sent), queued: asNumber(item.queued), failed: asNumber(item.failed), total: asNumber(item.total), lastSentAt: item.last_sent_at as string | null })), eventNames: eventNames.rows.map((item) => ({ eventName: String(item.event_name), platform: String(item.platform), count: asNumber(item.count), lastSeenAt: item.last_seen_at as string | null })), recentLeads: recentLeads.rows.map((item) => { const r = item as Record<string, unknown>; const list = ['utm_source','utm_medium','utm_campaign','fbp','fbc','fbclid','gclid'].filter((key) => Boolean(r[key])); return { id: String(r.id), name: String(r.name), stage: r.stage as PipelineStageKey, source: String(r.source), campaign: String(r.campaign), signals: list, createdAt: String(r.created_at) }; }), notes: ['Sem dados colados: esta página consulta leads, propostas e tracking_events reais do PostgreSQL do CRM.', 'UTM, fbp, fbc, fbclid e gclid indicam qualidade de atribuição preservada no lead.', trackingEvents === 0 ? 'Ainda não há eventos em tracking_events para os filtros atuais; quando CAPI ou Ads disparar, os status aparecem aqui.' : 'Eventos de conversão encontrados e agrupados por plataforma e status.'] };
    },
    async close() { await pool.end(); },
  };
}
