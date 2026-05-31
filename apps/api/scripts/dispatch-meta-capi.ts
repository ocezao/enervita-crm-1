import { readEnv } from '../src/config/env.ts';
import { createPgMetaDispatchRepository, dispatchQueuedMetaEvents } from '../src/modules/ads/metaCapiDispatcher.ts';

const env = readEnv();
const limit = Number.parseInt(process.env.META_CAPI_DISPATCH_LIMIT ?? '25', 10);
const maxAttempts = Number.parseInt(process.env.META_CAPI_MAX_ATTEMPTS ?? '3', 10);
const repository = createPgMetaDispatchRepository(env.databaseUrl, Number.isFinite(maxAttempts) ? maxAttempts : 3);

try {
  const summary = await dispatchQueuedMetaEvents({
    repository,
    accessToken: env.metaAds.accessToken,
    datasetId: env.metaAds.datasetId,
    graphApiVersion: env.metaAds.graphApiVersion,
    testEventCode: env.metaAds.testEventCode,
    limit: Number.isFinite(limit) ? limit : 25,
  });
  console.log(JSON.stringify({ ok: true, datasetConfigured: Boolean(env.metaAds.datasetId), tokenConfigured: Boolean(env.metaAds.accessToken), testMode: Boolean(env.metaAds.testEventCode), ...summary }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'unknown Meta CAPI dispatcher error' }));
  process.exitCode = 1;
} finally {
  await repository.close?.();
}
