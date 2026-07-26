import type { FastifyPluginAsync } from "fastify";
import type { PurchaseOrderUseCases } from "@stock-management/application";
import {
  CreatePurchaseOrderSchema,
  PurchaseOrderIdParamsSchema,
  UpdatePurchaseOrderSchema,
} from "@stock-management/shared";
import {
  assertDocumentBranchWrite,
  listFilterFromContext,
} from "./branch-scope.js";

export function purchaseOrdersRoutes(
  useCases: PurchaseOrderUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/purchase-orders", async (request) =>
      useCases.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
    );

    app.get<{ Params: { id: string } }>(
      "/purchase-orders/:id",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        return useCases.get(request.ctx.orgId, id);
      },
    );

    app.post("/purchase-orders", async (request) => {
      const body = CreatePurchaseOrderSchema.parse(request.body);
      assertDocumentBranchWrite(
        request.ctx,
        "po.write",
        body.branchId,
        "Role cannot write purchase orders",
      );
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/purchase-orders/:id",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        const body = UpdatePurchaseOrderSchema.parse(request.body);
        const existing = await useCases.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "po.write",
          body.branchId ?? existing.branchId,
          "Role cannot write purchase orders",
        );
        return useCases.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/submit",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        const po = await useCases.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "po.write",
          po.branchId,
          "Role cannot write purchase orders",
        );
        return useCases.submit(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/cancel",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        const po = await useCases.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "po.write",
          po.branchId,
          "Role cannot write purchase orders",
        );
        return useCases.cancel(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/close",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        const po = await useCases.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "po.write",
          po.branchId,
          "Role cannot write purchase orders",
        );
        return useCases.close(request.ctx.orgId, id);
      },
    );
  };
}
