import Fastify, { type FastifyInstance } from 'fastify';
import { readEnv } from './config/env.ts';
import { registerAuthRoutes } from './modules/auth/auth.routes.ts';
import { createPgUserRepository, type UserRepository } from './modules/auth/userRepository.ts';
import { createPgUsersRepository, type UsersRepository } from './modules/users/repository.ts';
import { registerUsersRoutes } from './modules/users/users.routes.ts';

export type CreateAppOptions = {
  userRepository?: UserRepository;
  usersRepository?: UsersRepository;
  sessionSecret?: string;
  secureCookies?: boolean;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const env = readEnv();
  const app = Fastify({ logger: false });
  const userRepository = options.userRepository ?? createPgUserRepository(env.databaseUrl);
  const usersRepository = options.usersRepository ?? createPgUsersRepository(env.databaseUrl);
  const sessionSecret = options.sessionSecret ?? env.sessionSecret;
  const secureCookies = options.secureCookies ?? env.nodeEnv === 'production';

  app.get('/health', async () => ({ ok: true }));

  void registerAuthRoutes(app, { userRepository, sessionSecret, secureCookies });
  void registerUsersRoutes(app, { userRepository, usersRepository, sessionSecret });

  app.addHook('onClose', async () => {
    await userRepository.close?.();
    await usersRepository.close?.();
  });

  return app;
}
