import type { FastifyPluginAsync } from "fastify";
import type { PurchaseOrderUseCases } from "@stock-management/application";
import {
  CreatePurchaseOrderSchema,
  PurchaseOrderIdParamsSchema,
  UpdatePurchaseOrderSchema,
} from "@stock-management/shared";

export function purchaseOrdersRoutes(
  useCases: PurchaseOrderUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/purchase-orders", async (request) =>
      useCases.list(request.ctx.orgId),
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
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/purchase-orders/:id",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        const body = UpdatePurchaseOrderSchema.parse(request.body);
        return useCases.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/submit",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        return useCases.submit(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/cancel",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        return useCases.cancel(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/purchase-orders/:id/close",
      async (request) => {
        const { id } = PurchaseOrderIdParamsSchema.parse(request.params);
        return useCases.close(request.ctx.orgId, id);
      },
    );
  };
}
