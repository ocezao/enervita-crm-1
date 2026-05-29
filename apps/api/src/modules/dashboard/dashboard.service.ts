import { getStageScopeForUser } from '../permissions/permission.service.ts';
import type { PublicUser } from '../auth/userRepository.ts';
import type { DashboardRepository } from './repository.ts';

export async function getDashboardMetrics(repository: DashboardRepository, actor: PublicUser) {
  return repository.getMetrics(actor.tenantId, getStageScopeForUser(actor));
}
