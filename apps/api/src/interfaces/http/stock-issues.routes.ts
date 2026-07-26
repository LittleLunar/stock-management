import type { FastifyPluginAsync } from "fastify";
import type {
  PostStockIssue,
  StockIssueUseCases,
  VoidStockIssue,
} from "@stock-management/application";
import {
  CreateStockIssueSchema,
  PostStockIssueHeadersSchema,
  PostStockIssueSchema,
  StockIssueIdParamsSchema,
  UpdateStockIssueSchema,
} from "@stock-management/shared";

export type StockIssueRouteUseCases = {
  stockIssues: StockIssueUseCases;
  postStockIssue: PostStockIssue;
  voidStockIssue: VoidStockIssue;
};

export function stockIssuesRoutes(
  useCases: StockIssueRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/stock-issues", async (request) =>
      useCases.stockIssues.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>(
      "/stock-issues/:id",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        return useCases.stockIssues.get(request.ctx.orgId, id);
      },
    );

    app.post("/stock-issues", async (request) => {
      const body = CreateStockIssueSchema.parse(request.body);
      return useCases.stockIssues.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/stock-issues/:id",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        const body = UpdateStockIssueSchema.parse(request.body);
        return useCases.stockIssues.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-issues/:id/post",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        const body = PostStockIssueSchema.parse(request.body ?? {});
        const headerKey = PostStockIssueHeadersSchema.parse(request.headers);
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postStockIssue.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-issues/:id/void",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        return useCases.voidStockIssue.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
