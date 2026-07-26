import type { FastifyPluginAsync } from "fastify";
import type {
  PostStockCount,
  StockCountUseCases,
  VoidStockCount,
} from "@stock-management/application";
import {
  CreateStockCountSchema,
  PostStockCountHeadersSchema,
  PostStockCountSchema,
  StockCountIdParamsSchema,
  UpdateStockCountSchema,
} from "@stock-management/shared";

export type StockCountRouteUseCases = {
  stockCounts: StockCountUseCases;
  postStockCount: PostStockCount;
  voidStockCount: VoidStockCount;
};

export function stockCountsRoutes(
  useCases: StockCountRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/stock-counts", async (request) =>
      useCases.stockCounts.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>(
      "/stock-counts/:id",
      async (request) => {
        const { id } = StockCountIdParamsSchema.parse(request.params);
        return useCases.stockCounts.get(request.ctx.orgId, id);
      },
    );

    app.post("/stock-counts", async (request) => {
      const body = CreateStockCountSchema.parse(request.body);
      return useCases.stockCounts.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/stock-counts/:id",
      async (request) => {
        const { id } = StockCountIdParamsSchema.parse(request.params);
        const body = UpdateStockCountSchema.parse(request.body);
        return useCases.stockCounts.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-counts/:id/post",
      async (request) => {
        const { id } = StockCountIdParamsSchema.parse(request.params);
        const body = PostStockCountSchema.parse(request.body ?? {});
        const headerKey = PostStockCountHeadersSchema.parse(request.headers);
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postStockCount.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-counts/:id/void",
      async (request) => {
        const { id } = StockCountIdParamsSchema.parse(request.params);
        return useCases.voidStockCount.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
