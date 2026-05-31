export type MetaAdsEnv = {
  accessToken: string;
  adAccountId: string;
  adAccountNumericId: string;
  businessId: string;
  pixelId: string;
  datasetId: string;
  pixelName: string;
  graphApiVersion: string;
  testEventCode: string;
};

export type AppEnv = {
  nodeEnv: string;
  host: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  metaAds: MetaAdsEnv;
  n8nDatabaseUrl: string;
};

const DEFAULT_PORT = 4000;
const DEFAULT_DATABASE_URL = 'postgres://enervita:enervita@127.0.0.1:55432/enervita_crm';
const DEVELOPMENT_SESSION_SECRET = 'development-session-secret-minimum-32-chars';

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

function readSessionSecret(env: NodeJS.ProcessEnv, nodeEnv: string): string {
  const value = env.SESSION_SECRET?.trim();
  if (value) {
    if (value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
    return value;
  }

  if (nodeEnv === 'production') {
    throw new Error('SESSION_SECRET is required in production.');
  }

  return DEVELOPMENT_SESSION_SECRET;
}

export function readEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';

  return {
    nodeEnv,
    host: env.HOST?.trim() || '127.0.0.1',
    port: parsePort(env.PORT),
    databaseUrl: env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    sessionSecret: readSessionSecret(env, nodeEnv),
    metaAds: {
      accessToken: trimEnv(env.META_ADS_ACCESS_TOKEN),
      adAccountId: trimEnv(env.META_AD_ACCOUNT_ID),
      adAccountNumericId: trimEnv(env.META_AD_ACCOUNT_NUMERIC_ID),
      businessId: trimEnv(env.META_BUSINESS_ID),
      pixelId: trimEnv(env.META_PIXEL_ID),
      datasetId: trimEnv(env.META_DATASET_ID || env.META_PIXEL_ID),
      pixelName: trimEnv(env.META_PIXEL_NAME) || 'Enervita - Site',
      graphApiVersion: trimEnv(env.META_GRAPH_API_VERSION) || 'v23.0',
      testEventCode: trimEnv(env.META_TEST_EVENT_CODE),
    },
    n8nDatabaseUrl: trimEnv(env.N8N_DATABASE_URL),
  };
}
