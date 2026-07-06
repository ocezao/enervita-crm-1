import pg from 'pg';
import { getDatabasePool } from '../../db/pool.ts';
import type { MetaAdsEnv } from '../../config/env.ts';

const { Pool } = pg;

export type AdsPlatform = 'meta' | 'google_ads';
export type AdsAccountStatus = 'pending_credentials' | 'connected' | 'error' | 'disabled';

type JsonObject = Record<string, unknown>;

const META_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const META_FETCH_LIMIT = 50;
const META_MAX_PAGES = 10;
const META_REQUEST_TIMEOUT_MS = 12_000;
const ACTIVE_META_STATUSES = ['active', 'enabled', 'running'];
const META_ACTIVE_STATUS_FILTER = JSON.stringify(['ACTIVE']);

export type AdsAccount = {
  id: string;
  platform: AdsPlatform;
  accountName: string;
  externalAccountId: string | null;
  status: AdsAccountStatus;
  credentialHint: string | null;
  lastSyncAt: string | null;
  syncError: string | null;
  metadata: JsonObject;
};

export type AdCreative = {
  id: string;
  externalAdId: string | null;
  name: string;
  effectiveStatus: string;
  creativeName: string | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  body: string | null;
  destinationUrl: string | null;
  metadata: JsonObject;
};

export type AdSet = {
  id: string;
  externalAdSetId: string | null;
  name: string;
  effectiveStatus: string;
  budgetAmount: number | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  audienceSummary: string | null;
  metadata: JsonObject;
  ads: AdCreative[];
};

export type AdCampaign = {
  id: string;
  platform: AdsPlatform;
  externalCampaignId: string | null;
  name: string;
  objective: string | null;
  effectiveStatus: string;
  budgetAmount: number | null;
  spendAmount: number;
  impressions: number;
  clicks: number;
  leads: number;
  lastSeenAt: string | null;
  buyingType: string | null;
  bidStrategy: string | null;
  budgetRemaining: number | null;
  metadata: JsonObject;
  adSets: AdSet[];
};

export type DetectedCampaign = {
  platform: AdsPlatform | 'unknown';
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  leads: number;
  firstLeadAt: string;
  lastLeadAt: string;
};

export type AdsSyncResult = {
  platform: 'meta';
  accountId: string;
  pixelId: string;
  pixelName: string;
  campaigns: number;
  adSets: number;
  ads: number;
  customAudiences: number;
  syncedAt: string;
  skipped?: boolean;
  reason?: string;
};

export type AdsOverview = {
  accounts: AdsAccount[];
  campaigns: AdCampaign[];
  detectedCampaigns: DetectedCampaign[];
  summary: {
    connectedAccounts: number;
    pendingCredentialAccounts: number;
    activeCampaigns: number;
    activeAdSets: number;
    activeAds: number;
    detectedUtmCampaigns: number;
  };
  credentialRequirements: Record<AdsPlatform, string[]>;
};

export type AdsRepository = {
  getOverview(tenantId: string): Promise<AdsOverview>;
  syncMetaAds?(tenantId: string): Promise<AdsSyncResult>;
  syncMetaAdsIfStale?(tenantId: string): Promise<AdsSyncResult>;
  close?(): Promise<void>;
};

export const CREDENTIAL_REQUIREMENTS: Record<AdsPlatform, string[]> = {
  meta: ['Token Meta Ads com ads_read/ads_management', 'Conta CA - Enervita conectada', 'Pixel/Dataset Enervita - Site (872374598469267)', 'Sync de campanhas/conjuntos/anúncios habilitado'],
  google_ads: ['Customer ID da conta', 'Developer token', 'OAuth client/refresh token', 'MCC/conta autorizada para leitura'],
};

function money(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function centsToMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

function jsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function nestedString(value: JsonObject, path: string[]): string | null {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') return null;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor : null;
}

function rowToAccount(row: Record<string, unknown>): AdsAccount {
  return {
    id: row.id as string,
    platform: row.platform as AdsPlatform,
    accountName: row.accountName as string,
    externalAccountId: row.externalAccountId as string | null,
    status: row.status as AdsAccountStatus,
    credentialHint: row.credentialHint as string | null,
    lastSyncAt: row.lastSyncAt as string | null,
    syncError: row.syncError as string | null,
    metadata: jsonObject(row.metadata),
  };
}

function providerFromUtm(source: string | null, hasMetaClickId: boolean, hasGoogleClickId: boolean): AdsPlatform | 'unknown' {
  const normalized = (source ?? '').toLowerCase();
  if (hasMetaClickId || ['facebook', 'fb', 'instagram', 'ig', 'meta'].some((item) => normalized.includes(item))) return 'meta';
  if (hasGoogleClickId || ['google', 'google_ads', 'adwords', 'youtube'].some((item) => normalized.includes(item))) return 'google_ads';
  return 'unknown';
}

function active(status: string): boolean {
  return ACTIVE_META_STATUSES.includes(status.toLowerCase());
}

function activeMetaRow(row: JsonObject): boolean {
  return active(String(row.effective_status ?? row.status ?? ''));
}

function safeMetaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido ao sincronizar Meta Ads');
  return message.replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]').slice(0, 1000);
}

function syncFresh(lastSyncAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastSyncAt) return false;
  const timestamp = new Date(lastSyncAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp < META_SYNC_INTERVAL_MS;
}

function metaActionCount(insight: JsonObject, actionTypes: string[]): number {
  const actions = Array.isArray(insight.actions) ? insight.actions as JsonObject[] : [];
  return actions.reduce((total, action) => actionTypes.includes(String(action.action_type ?? '')) ? total + Number(action.value ?? 0) : total, 0);
}

function insightMetrics(insight: JsonObject | undefined) {
  return {
    spend: money(insight?.spend),
    impressions: Number(insight?.impressions ?? 0),
    clicks: Number(insight?.clicks ?? 0),
    leads: metaActionCount(insight ?? {}, ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']),
  };
}

function targetingSummary(targeting: JsonObject): string | null {
  const pieces: string[] = [];
  const geo = jsonObject(targeting.geo_locations);
  const cities = Array.isArray(geo.cities) ? geo.cities as JsonObject[] : [];
  const regions = Array.isArray(geo.regions) ? geo.regions as JsonObject[] : [];
  const countries = Array.isArray(geo.countries) ? geo.countries as string[] : [];
  const customAudiences = Array.isArray(targeting.custom_audiences) ? targeting.custom_audiences as JsonObject[] : [];
  const interests = Array.isArray(targeting.interests) ? targeting.interests as JsonObject[] : [];
  if (cities.length) pieces.push(cities.slice(0, 3).map((city) => city.name).filter(Boolean).join(', '));
  if (!cities.length && regions.length) pieces.push(regions.slice(0, 3).map((region) => region.name).filter(Boolean).join(', '));
  if (!cities.length && !regions.length && countries.length) pieces.push(countries.slice(0, 3).join(', '));
  if (customAudiences.length) pieces.push(`${customAudiences.length} público(s) personalizado(s)`);
  if (interests.length) pieces.push(`${interests.length} interesse(s)`);
  return pieces.filter(Boolean).join(' · ') || null;
}

function creativeFields(creative: JsonObject): { title: string | null; body: string | null; thumbnailUrl: string | null; destinationUrl: string | null } {
  const objectStory = jsonObject(creative.object_story_spec);
  const linkData = jsonObject(objectStory.link_data);
  const videoData = jsonObject(objectStory.video_data);
  const assetFeed = jsonObject(creative.asset_feed_spec);
  const bodies = Array.isArray(assetFeed.bodies) ? assetFeed.bodies as JsonObject[] : [];
  const titles = Array.isArray(assetFeed.titles) ? assetFeed.titles as JsonObject[] : [];
  const linkUrls = Array.isArray(assetFeed.link_urls) ? assetFeed.link_urls as JsonObject[] : [];
  return {
    title: (creative.title as string | undefined) ?? (linkData.name as string | undefined) ?? (titles[0]?.text as string | undefined) ?? null,
    body: (creative.body as string | undefined) ?? (linkData.message as string | undefined) ?? (videoData.message as string | undefined) ?? (bodies[0]?.text as string | undefined) ?? null,
    thumbnailUrl: (creative.thumbnail_url as string | undefined) ?? (creative.image_url as string | undefined) ?? (linkData.picture as string | undefined) ?? null,
    destinationUrl: (linkData.link as string | undefined) ?? (linkUrls[0]?.website_url as string | undefined) ?? null,
  };
}

async function fetchJsonWithTimeout(url: string): Promise<{ ok: boolean; status: number; body: JsonObject }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json() as JsonObject;
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMetaPage(path: string, params: Record<string, string>, token: string, version: string): Promise<JsonObject> {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  url.searchParams.set('access_token', token);
  const response = await fetchJsonWithTimeout(url.toString());
  if (!response.ok) {
    const error = jsonObject(response.body.error);
    throw new Error(safeMetaError(String(error.message ?? `Meta API HTTP ${response.status}`)));
  }
  return response.body;
}

async function fetchMetaAll(path: string, params: Record<string, string>, token: string, version: string): Promise<JsonObject[]> {
  const first = await fetchMetaPage(path, { limit: String(META_FETCH_LIMIT), ...params }, token, version);
  const rows: JsonObject[] = Array.isArray(first.data) ? first.data as JsonObject[] : [];
  let next = nestedString(jsonObject(first.paging), ['next']);
  let pages = 1;
  while (next && pages < META_MAX_PAGES) {
    const response = await fetchJsonWithTimeout(next);
    if (!response.ok) {
      const error = jsonObject(response.body.error);
      throw new Error(safeMetaError(String(error.message ?? `Meta API HTTP ${response.status}`)));
    }
    rows.push(...(Array.isArray(response.body.data) ? response.body.data as JsonObject[] : []));
    next = nestedString(jsonObject(response.body.paging), ['next']);
    pages += 1;
  }
  return rows;
}

async function upsertAccount(pool: pg.Pool | pg.PoolClient, tenantId: string, metaConfig: MetaAdsEnv, metadata: JsonObject): Promise<string> {
  const accountName = 'Meta Ads - Enervita';
  const result = await pool.query(
    `insert into ad_platform_accounts (tenant_id, platform, account_name, external_account_id, status, credential_hint, last_sync_at, sync_error, metadata)
     values ($1, 'meta', $2, $3, 'connected', $4, now(), null, $5::jsonb)
     on conflict (tenant_id, platform, account_name)
     do update set external_account_id = excluded.external_account_id, status = 'connected', credential_hint = excluded.credential_hint, last_sync_at = now(), sync_error = null, metadata = excluded.metadata, updated_at = now()
     returning id`,
    [tenantId, accountName, metaConfig.adAccountId, `Conectado ao Pixel ${metaConfig.pixelName} (${metaConfig.pixelId})`, JSON.stringify(metadata)],
  );
  return result.rows[0].id as string;
}

async function markMetaError(pool: pg.Pool | pg.PoolClient, tenantId: string, message: string): Promise<void> {
  await pool.query(
    `insert into ad_platform_accounts (tenant_id, platform, account_name, status, credential_hint, sync_error, updated_at)
     values ($1, 'meta', 'Meta Ads - Enervita', 'error', 'Erro ao sincronizar Meta Ads', $2, now())
     on conflict (tenant_id, platform, account_name)
     do update set status = 'error', sync_error = excluded.sync_error, updated_at = now()`,
    [tenantId, message.slice(0, 1000)],
  );
}

export function createStaticAdsRepository(): AdsRepository {
  return {
    async getOverview() {
      return {
        accounts: [
          { id: 'static-meta', platform: 'meta', accountName: 'Meta Ads - Enervita', externalAccountId: null, status: 'pending_credentials', credentialHint: 'Aguardando token, ad account id e pixel/dataset Enervita - Site', lastSyncAt: null, syncError: null, metadata: {} },
          { id: 'static-google', platform: 'google_ads', accountName: 'Google Ads - Enervita', externalAccountId: null, status: 'pending_credentials', credentialHint: 'Aguardando customer id, developer token e OAuth/refresh token', lastSyncAt: null, syncError: null, metadata: {} },
        ],
        campaigns: [],
        detectedCampaigns: [],
        summary: { connectedAccounts: 0, pendingCredentialAccounts: 2, activeCampaigns: 0, activeAdSets: 0, activeAds: 0, detectedUtmCampaigns: 0 },
        credentialRequirements: CREDENTIAL_REQUIREMENTS,
      };
    },
    async close() {},
  };
}

export function createPgAdsRepository(databaseUrl: string, metaConfig?: MetaAdsEnv): AdsRepository {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : getDatabasePool();
  const metaSyncInFlight = new Map<string, Promise<AdsSyncResult>>();

  const canSyncMeta = () => Boolean(metaConfig?.accessToken && metaConfig.adAccountId && metaConfig.pixelId);

  async function latestMetaSyncAt(tenantId: string): Promise<string | null> {
    const result = await pool.query(
      `select last_sync_at::text as "lastSyncAt" from ad_platform_accounts where tenant_id = $1 and platform = 'meta' order by last_sync_at desc nulls last limit 1`,
      [tenantId],
    );
    return result.rows[0]?.lastSyncAt ?? null;
  }

  async function runMetaSync(tenantId: string, options: { force: boolean }): Promise<AdsSyncResult> {
    if (!metaConfig?.accessToken || !metaConfig.adAccountId || !metaConfig.pixelId) {
      const missing = 'META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID e META_PIXEL_ID são obrigatórios para sincronizar Meta Ads.';
      await markMetaError(pool, tenantId, missing);
      throw new Error(missing);
    }

    if (!options.force && syncFresh(await latestMetaSyncAt(tenantId))) {
      return { platform: 'meta' as const, accountId: metaConfig.adAccountId, pixelId: metaConfig.pixelId, pixelName: metaConfig.pixelName, campaigns: 0, adSets: 0, ads: 0, customAudiences: 0, syncedAt: new Date().toISOString(), skipped: true, reason: 'Meta Ads sincronizado há menos de 10 minutos.' };
    }

    const existing = metaSyncInFlight.get(tenantId);
    if (existing) return existing;

    const promise: Promise<AdsSyncResult> = (async () => {
      const version = metaConfig.graphApiVersion || 'v23.0';
      const syncedAt = new Date().toISOString();
      try {
        const [adAccount, pixels, customAudiences, campaignsRaw, adSetsRaw, adsRaw, campaignInsights, adSetInsights, adInsights] = await Promise.all([
          fetchMetaPage(metaConfig.adAccountId, { fields: 'id,account_id,name,business,account_status,currency,timezone_name' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/adspixels`, { fields: 'id,name,last_fired_time,owner_business,is_unavailable,data_use_setting,first_party_cookie_status' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/customaudiences`, { fields: 'id,name,subtype,approximate_count,delivery_status,operation_status,permission_for_actions' }, metaConfig.accessToken, version).catch(() => []),
          fetchMetaAll(`${metaConfig.adAccountId}/campaigns`, { effective_status: META_ACTIVE_STATUS_FILTER, fields: 'id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget,budget_remaining,bid_strategy,buying_type,start_time,stop_time,special_ad_categories' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/adsets`, { effective_status: META_ACTIVE_STATUS_FILTER, fields: 'id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,bid_strategy,billing_event,optimization_goal,targeting,promoted_object,start_time,end_time,created_time,updated_time' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/ads`, { effective_status: META_ACTIVE_STATUS_FILTER, fields: 'id,name,status,effective_status,adset_id,campaign_id,created_time,updated_time,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id}' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/insights`, { date_preset: 'last_30d', level: 'campaign', fields: 'campaign_id,spend,impressions,clicks,actions' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/insights`, { date_preset: 'last_30d', level: 'adset', fields: 'adset_id,spend,impressions,clicks,actions' }, metaConfig.accessToken, version),
          fetchMetaAll(`${metaConfig.adAccountId}/insights`, { date_preset: 'last_30d', level: 'ad', fields: 'ad_id,spend,impressions,clicks,actions' }, metaConfig.accessToken, version),
        ]);

        const activeCampaigns = campaignsRaw.filter(activeMetaRow);
        const activeCampaignIds = new Set(activeCampaigns.map((campaign) => String(campaign.id)));
        const activeAdSets = adSetsRaw.filter((adSet) => activeMetaRow(adSet) && activeCampaignIds.has(String(adSet.campaign_id)));
        const activeAdSetIds = new Set(activeAdSets.map((adSet) => String(adSet.id)));
        const activeAds = adsRaw.filter((ad) => activeMetaRow(ad) && activeAdSetIds.has(String(ad.adset_id)));
        const adSetsWithActiveAds = new Set(activeAds.map((ad) => String(ad.adset_id)));
        const campaignIdsWithActiveAds = new Set(activeAdSets.filter((adSet) => adSetsWithActiveAds.has(String(adSet.id))).map((adSet) => String(adSet.campaign_id)));
        const campaigns = activeCampaigns.filter((campaign) => campaignIdsWithActiveAds.has(String(campaign.id)));
        const adSets = activeAdSets.filter((adSet) => campaignIdsWithActiveAds.has(String(adSet.campaign_id)) && adSetsWithActiveAds.has(String(adSet.id)));
        const ads = activeAds.filter((ad) => adSetsWithActiveAds.has(String(ad.adset_id)));

        const selectedPixel = pixels.find((pixel) => String(pixel.id) === metaConfig.pixelId) ?? pixels.find((pixel) => String(pixel.name) === metaConfig.pixelName);
        const campaignInsightsById = new Map(campaignInsights.map((row) => [String(row.campaign_id), row]));
        const adSetInsightsById = new Map(adSetInsights.map((row) => [String(row.adset_id), row]));
        const adInsightsById = new Map(adInsights.map((row) => [String(row.ad_id), row]));

        const client = await pool.connect();
        try {
          await client.query('begin');
          const accountId = await upsertAccount(client, tenantId, metaConfig, { adAccount, pixel: selectedPixel ?? { id: metaConfig.pixelId, name: metaConfig.pixelName }, pixels, customAudiences, graphApiVersion: version, syncedAt, filters: { status: 'ACTIVE', intervalMinutes: 10, pageLimit: META_FETCH_LIMIT, maxPages: META_MAX_PAGES, requestTimeoutMs: META_REQUEST_TIMEOUT_MS } });
          await client.query(`update ads set effective_status = 'not_current', updated_at = now() where tenant_id = $1 and platform = 'meta'`, [tenantId]);
          await client.query(`update ad_sets set effective_status = 'not_current', updated_at = now() where tenant_id = $1 and platform = 'meta'`, [tenantId]);
          await client.query(`update ad_campaigns set effective_status = 'not_current', updated_at = now() where tenant_id = $1 and platform = 'meta'`, [tenantId]);

          const campaignDbIds = new Map<string, string>();
          for (const campaign of campaigns) {
            const metrics = insightMetrics(campaignInsightsById.get(String(campaign.id)));
            const budgetAmount = centsToMoney(campaign.daily_budget) ?? centsToMoney(campaign.lifetime_budget);
            const metadata = { ...campaign, insight: campaignInsightsById.get(String(campaign.id)) ?? null };
            const result = await client.query(`insert into ad_campaigns (tenant_id, account_id, platform, external_campaign_id, name, objective, effective_status, budget_amount, spend_amount, impressions, clicks, leads, metadata, last_seen_at) values ($1, $2, 'meta', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, now()) on conflict (tenant_id, platform, external_campaign_id) do update set name = excluded.name, objective = excluded.objective, effective_status = excluded.effective_status, budget_amount = excluded.budget_amount, spend_amount = excluded.spend_amount, impressions = excluded.impressions, clicks = excluded.clicks, leads = excluded.leads, metadata = excluded.metadata, last_seen_at = now(), updated_at = now() returning id`, [tenantId, accountId, campaign.id, campaign.name ?? 'Campanha sem nome', campaign.objective ?? null, campaign.effective_status ?? campaign.status ?? 'unknown', budgetAmount, metrics.spend, metrics.impressions, metrics.clicks, metrics.leads, JSON.stringify(metadata)]);
            campaignDbIds.set(String(campaign.id), result.rows[0].id as string);
          }

          const adSetDbIds = new Map<string, string>();
          for (const adSet of adSets) {
            const campaignId = campaignDbIds.get(String(adSet.campaign_id));
            if (!campaignId) continue;
            const metrics = insightMetrics(adSetInsightsById.get(String(adSet.id)));
            const budgetAmount = centsToMoney(adSet.daily_budget) ?? centsToMoney(adSet.lifetime_budget);
            const metadata = { ...adSet, audience_summary: targetingSummary(jsonObject(adSet.targeting)), insight: adSetInsightsById.get(String(adSet.id)) ?? null };
            const result = await client.query(`insert into ad_sets (tenant_id, campaign_id, platform, external_ad_set_id, name, effective_status, budget_amount, spend_amount, impressions, clicks, leads, metadata, last_seen_at) values ($1, $2, 'meta', $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now()) on conflict (tenant_id, platform, external_ad_set_id) do update set campaign_id = excluded.campaign_id, name = excluded.name, effective_status = excluded.effective_status, budget_amount = excluded.budget_amount, spend_amount = excluded.spend_amount, impressions = excluded.impressions, clicks = excluded.clicks, leads = excluded.leads, metadata = excluded.metadata, last_seen_at = now(), updated_at = now() returning id`, [tenantId, campaignId, adSet.id, adSet.name ?? 'Conjunto sem nome', adSet.effective_status ?? adSet.status ?? 'unknown', budgetAmount, metrics.spend, metrics.impressions, metrics.clicks, metrics.leads, JSON.stringify(metadata)]);
            adSetDbIds.set(String(adSet.id), result.rows[0].id as string);
          }

          for (const ad of ads) {
            const adSetId = adSetDbIds.get(String(ad.adset_id));
            if (!adSetId) continue;
            const creative = jsonObject(ad.creative);
            const info = creativeFields(creative);
            const metrics = insightMetrics(adInsightsById.get(String(ad.id)));
            const metadata = { ...ad, creative, creative_fields: info, insight: adInsightsById.get(String(ad.id)) ?? null };
            await client.query(`insert into ads (tenant_id, ad_set_id, platform, external_ad_id, name, effective_status, creative_name, spend_amount, impressions, clicks, leads, metadata, last_seen_at) values ($1, $2, 'meta', $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now()) on conflict (tenant_id, platform, external_ad_id) do update set ad_set_id = excluded.ad_set_id, name = excluded.name, effective_status = excluded.effective_status, creative_name = excluded.creative_name, spend_amount = excluded.spend_amount, impressions = excluded.impressions, clicks = excluded.clicks, leads = excluded.leads, metadata = excluded.metadata, last_seen_at = now(), updated_at = now()`, [tenantId, adSetId, ad.id, ad.name ?? 'Anúncio sem nome', ad.effective_status ?? ad.status ?? 'unknown', creative.name ?? info.title ?? null, metrics.spend, metrics.impressions, metrics.clicks, metrics.leads, JSON.stringify(metadata)]);
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        } finally {
          client.release();
        }
        return { platform: 'meta' as const, accountId: metaConfig.adAccountId, pixelId: metaConfig.pixelId, pixelName: metaConfig.pixelName, campaigns: campaigns.length, adSets: adSets.length, ads: ads.length, customAudiences: customAudiences.length, syncedAt };
      } catch (error) {
        const message = safeMetaError(error);
        await markMetaError(pool, tenantId, message);
        throw new Error(message);
      }
    })().finally(() => metaSyncInFlight.delete(tenantId));
    metaSyncInFlight.set(tenantId, promise);
    return promise;
  }

  async function syncAllTenantsIfStale(): Promise<void> {
    if (!canSyncMeta()) return;
    const result = await pool.query(`select id from tenants order by created_at asc`);
    for (const row of result.rows) await runMetaSync(row.id as string, { force: false }).catch(() => undefined);
  }

  const initialSyncTimer = canSyncMeta() ? setTimeout(() => { void syncAllTenantsIfStale(); }, 5_000) : undefined;
  initialSyncTimer?.unref?.();
  const autoSyncTimer = canSyncMeta() ? setInterval(() => { void syncAllTenantsIfStale(); }, META_SYNC_INTERVAL_MS) : undefined;
  autoSyncTimer?.unref?.();

  return {
    async syncMetaAds(tenantId) { return runMetaSync(tenantId, { force: true }); },
    async syncMetaAdsIfStale(tenantId) { return runMetaSync(tenantId, { force: false }); },
    async getOverview(tenantId) {
      if (canSyncMeta()) await runMetaSync(tenantId, { force: false }).catch(() => undefined);
      const activeStatuses = ACTIVE_META_STATUSES;
      const [accountsResult, campaignsResult, adSetsResult, adsResult, detectedResult] = await Promise.all([
        pool.query(`select id, platform, account_name as "accountName", external_account_id as "externalAccountId", status, credential_hint as "credentialHint", last_sync_at::text as "lastSyncAt", sync_error as "syncError", metadata from ad_platform_accounts where tenant_id = $1 order by platform, account_name`, [tenantId]),
        pool.query(`select id, platform, external_campaign_id as "externalCampaignId", name, objective, effective_status as "effectiveStatus", budget_amount as "budgetAmount", spend_amount as "spendAmount", impressions, clicks, leads, last_seen_at::text as "lastSeenAt", metadata from ad_campaigns where tenant_id = $1 and lower(effective_status) = any($2::text[]) order by platform, lower(name)`, [tenantId, activeStatuses]),
        pool.query(`select id, campaign_id as "campaignId", external_ad_set_id as "externalAdSetId", name, effective_status as "effectiveStatus", budget_amount as "budgetAmount", spend_amount as "spendAmount", impressions, clicks, leads, last_seen_at::text as "lastSeenAt", metadata from ad_sets where tenant_id = $1 and lower(effective_status) = any($2::text[]) order by lower(name)`, [tenantId, activeStatuses]),
        pool.query(`select id, ad_set_id as "adSetId", external_ad_id as "externalAdId", name, effective_status as "effectiveStatus", creative_name as "creativeName", spend_amount as "spendAmount", impressions, clicks, leads, last_seen_at::text as "lastSeenAt", metadata from ads where tenant_id = $1 and lower(effective_status) = any($2::text[]) order by lower(name)`, [tenantId, activeStatuses]),
        pool.query(`select utm_source as "utmSource", utm_campaign as "utmCampaign", utm_content as "utmContent", bool_or(coalesce(fbc, '') <> '' or coalesce(fbclid, '') <> '') as "hasMetaClickId", bool_or(coalesce(gclid, '') <> '') as "hasGoogleClickId", count(*)::int as leads, min(created_at)::text as "firstLeadAt", max(created_at)::text as "lastLeadAt" from leads where tenant_id = $1 and (utm_source is not null or utm_campaign is not null or utm_content is not null or fbc is not null or fbclid is not null or gclid is not null) group by utm_source, utm_campaign, utm_content order by max(created_at) desc`, [tenantId]),
      ]);
      const adsBySet = new Map<string, AdCreative[]>();
      for (const row of adsResult.rows) {
        const metadata = jsonObject(row.metadata);
        const fields = jsonObject(metadata.creative_fields);
        const item: AdCreative = { id: row.id, externalAdId: row.externalAdId, name: row.name, effectiveStatus: row.effectiveStatus, creativeName: row.creativeName, spendAmount: money(row.spendAmount), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), leads: Number(row.leads ?? 0), lastSeenAt: row.lastSeenAt, thumbnailUrl: (fields.thumbnailUrl as string | undefined) ?? null, title: (fields.title as string | undefined) ?? null, body: (fields.body as string | undefined) ?? null, destinationUrl: (fields.destinationUrl as string | undefined) ?? null, metadata };
        adsBySet.set(row.adSetId, [...(adsBySet.get(row.adSetId) ?? []), item]);
      }
      const setsByCampaign = new Map<string, AdSet[]>();
      for (const row of adSetsResult.rows) {
        const metadata = jsonObject(row.metadata);
        const activeAdsForSet = adsBySet.get(row.id) ?? [];
        if (activeAdsForSet.length === 0) continue;
        const item: AdSet = { id: row.id, externalAdSetId: row.externalAdSetId, name: row.name, effectiveStatus: row.effectiveStatus, budgetAmount: row.budgetAmount === null ? null : money(row.budgetAmount), spendAmount: money(row.spendAmount), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), leads: Number(row.leads ?? 0), lastSeenAt: row.lastSeenAt, optimizationGoal: (metadata.optimization_goal as string | undefined) ?? null, billingEvent: (metadata.billing_event as string | undefined) ?? null, audienceSummary: (metadata.audience_summary as string | undefined) ?? null, metadata, ads: activeAdsForSet };
        setsByCampaign.set(row.campaignId, [...(setsByCampaign.get(row.campaignId) ?? []), item]);
      }
      const campaigns: AdCampaign[] = campaignsResult.rows.map((row) => {
        const metadata = jsonObject(row.metadata);
        return { id: row.id, platform: row.platform, externalCampaignId: row.externalCampaignId, name: row.name, objective: row.objective, effectiveStatus: row.effectiveStatus, budgetAmount: row.budgetAmount === null ? null : money(row.budgetAmount), spendAmount: money(row.spendAmount), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), leads: Number(row.leads ?? 0), lastSeenAt: row.lastSeenAt, buyingType: (metadata.buying_type as string | undefined) ?? null, bidStrategy: (metadata.bid_strategy as string | undefined) ?? null, budgetRemaining: centsToMoney(metadata.budget_remaining), metadata, adSets: setsByCampaign.get(row.id) ?? [] };
      }).filter((campaign) => active(campaign.effectiveStatus) && campaign.adSets.some((set) => active(set.effectiveStatus) && set.ads.some((ad) => active(ad.effectiveStatus))));
      const displayedAdSets = campaigns.flatMap((campaign) => campaign.adSets);
      const displayedAds = displayedAdSets.flatMap((set) => set.ads);
      const detectedCampaigns: DetectedCampaign[] = detectedResult.rows.map((row) => ({ platform: providerFromUtm(row.utmSource, Boolean(row.hasMetaClickId), Boolean(row.hasGoogleClickId)), utmSource: row.utmSource, utmCampaign: row.utmCampaign, utmContent: row.utmContent, leads: Number(row.leads ?? 0), firstLeadAt: row.firstLeadAt, lastLeadAt: row.lastLeadAt }));
      return { accounts: accountsResult.rows.map(rowToAccount), campaigns, detectedCampaigns, summary: { connectedAccounts: accountsResult.rows.filter((row) => row.status === 'connected').length, pendingCredentialAccounts: accountsResult.rows.filter((row) => row.status === 'pending_credentials').length, activeCampaigns: campaigns.length, activeAdSets: displayedAdSets.length, activeAds: displayedAds.length, detectedUtmCampaigns: detectedCampaigns.length }, credentialRequirements: CREDENTIAL_REQUIREMENTS };
    },
    async close() {
      if (initialSyncTimer) clearTimeout(initialSyncTimer);
      if (autoSyncTimer) clearInterval(autoSyncTimer);
      await pool.end();
    },
  };
}
