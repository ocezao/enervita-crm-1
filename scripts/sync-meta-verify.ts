import pg from 'pg';
import { createPgAdsRepository } from '../apps/api/src/modules/ads/repository.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const tenant = await pool.query('select id from tenants where slug = $1 limit 1', ['enervita']);
if (!tenant.rows[0]) throw new Error('tenant enervita not found');
const repo = createPgAdsRepository(process.env.DATABASE_URL || '', {
  accessToken: process.env.META_ADS_ACCESS_TOKEN || '',
  adAccountId: process.env.META_AD_ACCOUNT_ID || '',
  adAccountNumericId: process.env.META_AD_ACCOUNT_NUMERIC_ID || '',
  businessId: process.env.META_BUSINESS_ID || '',
  pixelId: process.env.META_PIXEL_ID || '',
  datasetId: process.env.META_DATASET_ID || process.env.META_PIXEL_ID || '',
  pixelName: process.env.META_PIXEL_NAME || 'Enervita - Site',
  graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v23.0',
});
const result = await repo.syncMetaAds?.(tenant.rows[0].id);
const overview = await repo.getOverview(tenant.rows[0].id);
console.log(JSON.stringify({
  result,
  summary: overview.summary,
  firstCampaign: overview.campaigns[0] ? {
    name: overview.campaigns[0].name,
    adSets: overview.campaigns[0].adSets.length,
    firstAd: overview.campaigns[0].adSets[0]?.ads[0] ? {
      name: overview.campaigns[0].adSets[0].ads[0].name,
      thumbnail: Boolean(overview.campaigns[0].adSets[0].ads[0].thumbnailUrl),
    } : null,
  } : null,
}, null, 2));
await repo.close?.();
await pool.end();
