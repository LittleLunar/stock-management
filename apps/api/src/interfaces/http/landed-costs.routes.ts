import type { FastifyPluginAsync } from "fastify";
import type {
  LandedCostUseCases,
  PostLandedCost,
  VoidLandedCost,
} from "@stock-management/application";
import {
  CreateLandedCostSchema,
  LandedCostIdParamsSchema,
  PostIdempotencyHeadersSchema,
  PostIdempotencySchema,
  UpdateLandedCostSchema,
} from "@stock-management/shared";

export type LandedCostRouteUseCases = {
  landedCosts: LandedCostUseCases;
  postLandedCost: PostLandedCost;
  voidLandedCost: VoidLandedCost;
};

export function landedCostsRoutes(
  useCases: LandedCostRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/landed-costs", async (request) =>
      useCases.landedCosts.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>("/landed-costs/:id", async (request) => {
      const { id } = LandedCostIdParamsSchema.parse(request.params);
      return useCases.landedCosts.get(request.ctx.orgId, id);
    });

    app.post("/landed-costs", async (request) => {
      const body = CreateLandedCostSchema.parse(request.body);
      return useCases.landedCosts.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/landed-costs/:id",
      async (request) => {
        const { id } = LandedCostIdParamsSchema.parse(request.params);
        const body = UpdateLandedCostSchema.parse(request.body);
        return useCases.landedCosts.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/landed-costs/:id/post",
      async (request) => {
        const { id } = LandedCostIdParamsSchema.parse(request.params);
        const body = PostIdempotencySchema.parse(request.body ?? {});
        const headers = PostIdempotencyHeadersSchema.parse(request.headers);
        const externalSystem = body.external_system ?? headers.external_system;
        const externalId = body.external_id ?? headers.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postLandedCost.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/landed-costs/:id/void",
      async (request) => {
        const { id } = LandedCostIdParamsSchema.parse(request.params);
        return useCases.voidLandedCost.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
