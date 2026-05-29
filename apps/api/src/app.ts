import Fastify, { type FastifyInstance } from 'fastify';
import { readEnv } from './config/env.ts';
import { registerAuthRoutes } from './modules/auth/auth.routes.ts';
import { createPgUserRepository, type UserRepository } from './modules/auth/userRepository.ts';

export type CreateAppOptions = {
  userRepository?: UserRepository;
  sessionSecret?: string;
  secureCookies?: boolean;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const env = readEnv();
  const app = Fastify({ logger: false });
  const userRepository = options.userRepository ?? createPgUserRepository(env.databaseUrl);
  const sessionSecret = options.sessionSecret ?? env.sessionSecret;
  const secureCookies = options.secureCookies ?? env.nodeEnv === 'production';

  app.get('/health', async () => ({ ok: true }));

  void registerAuthRoutes(app, { userRepository, sessionSecret, secureCookies });

  app.addHook('onClose', async () => {
    await userRepository.close?.();
  });

  return app;
}
