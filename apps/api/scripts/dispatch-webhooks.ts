import {
  createPgWebhookDispatchRepository,
  dispatchQueuedWebhooks,
  parseAllowedWebhookHosts,
} from '../src/modules/integrations/webhookDispatcher.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL is required' }));
  process.exit(1);
}

const allowedHosts = parseAllowedWebhookHosts(process.env.WEBHOOK_DISPATCH_ALLOWED_HOSTS ?? process.env.N8N_WEBHOOK_ALLOWED_HOSTS);
const limit = Number.parseInt(process.env.WEBHOOK_DISPATCH_LIMIT ?? '10', 10);
const repository = createPgWebhookDispatchRepository(databaseUrl);

try {
  const summary = await dispatchQueuedWebhooks({
    repository,
    allowedHosts,
    limit: Number.isFinite(limit) ? limit : 10,
  });
  console.log(JSON.stringify({ ok: true, allowedHostsConfigured: allowedHosts.length, ...summary }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'unknown dispatcher error' }));
  process.exitCode = 1;
} finally {
  await repository.close?.();
}
