import type { FastifyPluginAsync } from "fastify";
import type {
  CostRevaluationUseCases,
  PostCostRevaluation,
  VoidCostRevaluation,
} from "@stock-management/application";
import {
  CostRevaluationIdParamsSchema,
  CreateCostRevaluationSchema,
  PostIdempotencyHeadersSchema,
  PostIdempotencySchema,
  UpdateCostRevaluationSchema,
} from "@stock-management/shared";

export type CostRevaluationRouteUseCases = {
  costRevaluations: CostRevaluationUseCases;
  postCostRevaluation: PostCostRevaluation;
  voidCostRevaluation: VoidCostRevaluation;
};

export function costRevaluationsRoutes(
  useCases: CostRevaluationRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/cost-revaluations", async (request) =>
      useCases.costRevaluations.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>(
      "/cost-revaluations/:id",
      async (request) => {
        const { id } = CostRevaluationIdParamsSchema.parse(request.params);
        return useCases.costRevaluations.get(request.ctx.orgId, id);
      },
    );

    app.post("/cost-revaluations", async (request) => {
      const body = CreateCostRevaluationSchema.parse(request.body);
      return useCases.costRevaluations.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/cost-revaluations/:id",
      async (request) => {
        const { id } = CostRevaluationIdParamsSchema.parse(request.params);
        const body = UpdateCostRevaluationSchema.parse(request.body);
        return useCases.costRevaluations.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/cost-revaluations/:id/post",
      async (request) => {
        const { id } = CostRevaluationIdParamsSchema.parse(request.params);
        const body = PostIdempotencySchema.parse(request.body ?? {});
        const headers = PostIdempotencyHeadersSchema.parse(request.headers);
        const externalSystem = body.external_system ?? headers.external_system;
        const externalId = body.external_id ?? headers.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postCostRevaluation.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/cost-revaluations/:id/void",
      async (request) => {
        const { id } = CostRevaluationIdParamsSchema.parse(request.params);
        return useCases.voidCostRevaluation.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
