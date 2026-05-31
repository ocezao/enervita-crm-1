import Fastify, { type FastifyInstance } from 'fastify';
import { readEnv } from './config/env.ts';
import { registerAuthRoutes } from './modules/auth/auth.routes.ts';
import { createPgUserRepository, type UserRepository } from './modules/auth/userRepository.ts';
import { createPgUsersRepository, type UsersRepository } from './modules/users/repository.ts';
import { registerUsersRoutes } from './modules/users/users.routes.ts';
import { createPgLeadsRepository, type LeadsRepository } from './modules/leads/repository.ts';
import { registerLeadsRoutes } from './modules/leads/leads.routes.ts';
import { createPgEngagementRepository, type EngagementRepository } from './modules/engagement/repository.ts';
import { registerEngagementRoutes } from './modules/engagement/engagement.routes.ts';
import { createPgDashboardRepository, type DashboardRepository } from './modules/dashboard/repository.ts';
import { registerDashboardRoutes } from './modules/dashboard/dashboard.routes.ts';
import { registerIntegrationsRoutes } from './modules/integrations/integrations.routes.ts';
import { createPgIntegrationsRepository, createStaticIntegrationsRepository, type IntegrationsRepository } from './modules/integrations/repository.ts';
import { createPgProposalsRepository, type ProposalsRepository } from './modules/proposals/repository.ts';
import { registerProposalsRoutes } from './modules/proposals/proposals.routes.ts';
import { registerAdsRoutes } from './modules/ads/ads.routes.ts';
import { createPgAdsRepository, createStaticAdsRepository, type AdsRepository } from './modules/ads/repository.ts';
import { registerAnalyticsRoutes } from './modules/analytics/analytics.routes.ts';
import { createPgAnalyticsRepository, createStaticAnalyticsRepository, type AnalyticsRepository } from './modules/analytics/repository.ts';

export type CreateAppOptions = {
  userRepository?: UserRepository;
  usersRepository?: UsersRepository;
  leadsRepository?: LeadsRepository;
  engagementRepository?: EngagementRepository;
  dashboardRepository?: DashboardRepository;
  proposalsRepository?: ProposalsRepository;
  integrationsRepository?: IntegrationsRepository;
  adsRepository?: AdsRepository;
  analyticsRepository?: AnalyticsRepository;
  sessionSecret?: string;
  secureCookies?: boolean;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const env = readEnv();
  const app = Fastify({ logger: false });
  const userRepository = options.userRepository ?? createPgUserRepository(env.databaseUrl);
  const usersRepository = options.usersRepository ?? createPgUsersRepository(env.databaseUrl);
  const leadsRepository = options.leadsRepository ?? createPgLeadsRepository(env.databaseUrl);
  const engagementRepository = options.engagementRepository ?? createPgEngagementRepository(env.databaseUrl);
  const dashboardRepository = options.dashboardRepository ?? createPgDashboardRepository(env.databaseUrl);
  const proposalsRepository = options.proposalsRepository ?? createPgProposalsRepository(env.databaseUrl);
  const integrationsRepository = options.integrationsRepository ?? (options.userRepository ? createStaticIntegrationsRepository() : createPgIntegrationsRepository(env.databaseUrl, env.n8nDatabaseUrl));
  const adsRepository = options.adsRepository ?? (options.userRepository ? createStaticAdsRepository() : createPgAdsRepository(env.databaseUrl, env.metaAds));
  const analyticsRepository = options.analyticsRepository ?? (options.userRepository ? createStaticAnalyticsRepository() : createPgAnalyticsRepository(env.databaseUrl));
  const sessionSecret = options.sessionSecret ?? env.sessionSecret;
  const secureCookies = options.secureCookies ?? env.nodeEnv === 'production';

  app.get('/health', async () => ({ ok: true }));

  void registerAuthRoutes(app, { userRepository, sessionSecret, secureCookies });
  void registerUsersRoutes(app, { userRepository, usersRepository, sessionSecret });
  void registerLeadsRoutes(app, { userRepository, leadsRepository, sessionSecret });
  void registerEngagementRoutes(app, { userRepository, engagementRepository, sessionSecret });
  void registerDashboardRoutes(app, { userRepository, dashboardRepository, sessionSecret });
  void registerIntegrationsRoutes(app, { userRepository, integrationsRepository, sessionSecret });
  void registerProposalsRoutes(app, { userRepository, proposalsRepository, sessionSecret });
  void registerAdsRoutes(app, { userRepository, adsRepository, sessionSecret });
  void registerAnalyticsRoutes(app, { userRepository, analyticsRepository, sessionSecret });

  app.addHook('onClose', async () => {
    await userRepository.close?.();
    await usersRepository.close?.();
    await leadsRepository.close?.();
    await engagementRepository.close?.();
    await dashboardRepository.close?.();
    await proposalsRepository.close?.();
    await integrationsRepository.close?.();
    await adsRepository.close?.();
    await analyticsRepository.close?.();
  });

  return app;
}
