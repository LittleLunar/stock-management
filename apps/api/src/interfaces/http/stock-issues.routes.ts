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
import {
  assertDocumentBranchWrite,
  listFilterFromContext,
} from "./branch-scope.js";

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
      useCases.stockIssues.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
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
      assertDocumentBranchWrite(
        request.ctx,
        "inventory.post",
        body.branchId,
        "Role cannot post inventory documents",
      );
      return useCases.stockIssues.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/stock-issues/:id",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        const body = UpdateStockIssueSchema.parse(request.body);
        const existing = await useCases.stockIssues.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          body.branchId ?? existing.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.stockIssues.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-issues/:id/post",
      async (request) => {
        const { id } = StockIssueIdParamsSchema.parse(request.params);
        const doc = await useCases.stockIssues.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
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
        const doc = await useCases.stockIssues.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.voidStockIssue.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
