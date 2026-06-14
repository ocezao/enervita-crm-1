import type { FastifyInstance, FastifyRequest } from "fastify";
import { requirePermission } from "../../middleware/requireAuth.ts";
import { getStageScopeForUser } from "../permissions/permission.service.ts";
import type { PublicUser, UserRepository } from "../auth/userRepository.ts";
import type { FollowUpStatus, FollowUpsRepository } from "./repository.ts";

type FollowUpsRouteOptions = {
  userRepository: UserRepository;
  followUpsRepository: FollowUpsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

type ListQuery = {
  status?: FollowUpStatus;
  ruleKey?: string;
  limit?: string;
};

type IdParams = { id: string };

type SkipBody = { reason?: string };

type FailedBody = { error?: string };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error("Authenticated user missing after preHandler");
  return user;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}

export async function registerFollowUpsRoutes(
  app: FastifyInstance,
  options: FollowUpsRouteOptions,
): Promise<void> {
  const preHandler = requirePermission("page.automations", {
    userRepository: options.userRepository,
    sessionSecret: options.sessionSecret,
  });

  app.get<{ Querystring: ListQuery }>(
    "/api/follow-ups",
    { preHandler },
    async (request) => {
      const actor = authenticatedUser(request);
      const followUps = await options.followUpsRepository.listQueue(
        actor.tenantId,
        {
          status: request.query.status,
          ruleKey: request.query.ruleKey,
          limit: parseLimit(request.query.limit),
        },
      );
      return { followUps };
    },
  );

  app.post("/api/follow-ups/run-rules", { preHandler }, async (request) => {
    const actor = authenticatedUser(request);
    const result = await options.followUpsRepository.runRules(
      actor.tenantId,
      getStageScopeForUser(actor),
    );
    return { result };
  });

  app.post<{ Params: IdParams; Body: SkipBody }>(
    "/api/follow-ups/:id/skip",
    { preHandler },
    async (request, reply) => {
      const actor = authenticatedUser(request);
      const followUp = await options.followUpsRepository.markSkipped(
        actor.tenantId,
        request.params.id,
        request.body?.reason,
        actor,
      );
      if (!followUp)
        return reply
          .code(404)
          .send({ error: "Follow-up não encontrado ou já processado" });
      return { followUp };
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/follow-ups/:id/sent",
    { preHandler },
    async (request, reply) => {
      const actor = authenticatedUser(request);
      const followUp = await options.followUpsRepository.markSent(
        actor.tenantId,
        request.params.id,
        actor,
      );
      if (!followUp)
        return reply
          .code(404)
          .send({ error: "Follow-up não encontrado ou já processado" });
      return { followUp };
    },
  );

  app.post<{ Params: IdParams; Body: FailedBody }>(
    "/api/follow-ups/:id/failed",
    { preHandler },
    async (request, reply) => {
      const actor = authenticatedUser(request);
      const followUp = await options.followUpsRepository.markFailed(
        actor.tenantId,
        request.params.id,
        request.body?.error ?? "Erro não informado",
        actor,
      );
      if (!followUp)
        return reply
          .code(404)
          .send({ error: "Follow-up não encontrado ou já processado" });
      return { followUp };
    },
  );
}
