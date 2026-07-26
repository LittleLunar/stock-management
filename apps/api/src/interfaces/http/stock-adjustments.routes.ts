import type { FastifyPluginAsync } from "fastify";
import type {
  PostStockAdjustment,
  StockAdjustmentUseCases,
  VoidStockAdjustment,
} from "@stock-management/application";
import {
  CreateStockAdjustmentSchema,
  PostStockAdjustmentHeadersSchema,
  PostStockAdjustmentSchema,
  StockAdjustmentIdParamsSchema,
  UpdateStockAdjustmentSchema,
} from "@stock-management/shared";
import {
  assertDocumentBranchWrite,
  listFilterFromContext,
} from "./branch-scope.js";

export type StockAdjustmentRouteUseCases = {
  stockAdjustments: StockAdjustmentUseCases;
  postStockAdjustment: PostStockAdjustment;
  voidStockAdjustment: VoidStockAdjustment;
};

export function stockAdjustmentsRoutes(
  useCases: StockAdjustmentRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/stock-adjustments", async (request) =>
      useCases.stockAdjustments.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
    );

    app.get<{ Params: { id: string } }>(
      "/stock-adjustments/:id",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        return useCases.stockAdjustments.get(request.ctx.orgId, id);
      },
    );

    app.post("/stock-adjustments", async (request) => {
      const body = CreateStockAdjustmentSchema.parse(request.body);
      assertDocumentBranchWrite(
        request.ctx,
        "inventory.post",
        body.branchId,
        "Role cannot post inventory documents",
      );
      return useCases.stockAdjustments.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/stock-adjustments/:id",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        const body = UpdateStockAdjustmentSchema.parse(request.body);
        const existing = await useCases.stockAdjustments.get(
          request.ctx.orgId,
          id,
        );
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          body.branchId ?? existing.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.stockAdjustments.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-adjustments/:id/submit",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        const doc = await useCases.stockAdjustments.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.stockAdjustments.submitForApproval(
          request.ctx.orgId,
          id,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-adjustments/:id/approve",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        const doc = await useCases.stockAdjustments.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "document.approve",
          doc.branchId,
          "Role cannot approve documents",
        );
        return useCases.stockAdjustments.approve(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-adjustments/:id/post",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        const doc = await useCases.stockAdjustments.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        const body = PostStockAdjustmentSchema.parse(request.body ?? {});
        const headerKey = PostStockAdjustmentHeadersSchema.parse(
          request.headers,
        );
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postStockAdjustment.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-adjustments/:id/void",
      async (request) => {
        const { id } = StockAdjustmentIdParamsSchema.parse(request.params);
        const doc = await useCases.stockAdjustments.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.voidStockAdjustment.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
