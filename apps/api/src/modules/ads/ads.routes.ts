import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { AdsRepository } from './repository.ts';

type AdsRouteOptions = {
  userRepository: UserRepository;
  adsRepository: AdsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

export async function registerAdsRoutes(app: FastifyInstance, options: AdsRouteOptions): Promise<void> {
  const adsPreHandler = requirePermission('page.ads', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/ads/overview', { preHandler: adsPreHandler }, async (request) => {
    const user = authenticatedUser(request);
    return { overview: await options.adsRepository.getOverview(user.tenantId) };
  });

  app.post('/api/ads/sync/meta', { preHandler: adsPreHandler }, async (request, reply) => {
    const user = authenticatedUser(request);
    if (!options.adsRepository.syncMetaAds) {
      return reply.status(501).send({ error: 'Sincronização Meta Ads indisponível neste ambiente.' });
    }
    const result = await options.adsRepository.syncMetaAds(user.tenantId);
    return { result, overview: await options.adsRepository.getOverview(user.tenantId) };
  });
}
