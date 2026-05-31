import { createApp } from './app.ts';
import { readEnv } from './config/env.ts';

const env = readEnv();
const app = createApp();

try {
  await app.listen({ host: env.host, port: env.port });
  console.log(`API listening on ${env.host}:${env.port} (${env.nodeEnv})`);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
