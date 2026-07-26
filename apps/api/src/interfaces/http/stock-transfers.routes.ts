import type { FastifyPluginAsync } from "fastify";
import type {
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockTransferUseCases,
  VoidStockTransfer,
} from "@stock-management/application";
import { assertBranchAccess } from "@stock-management/domain";
import {
  CreateStockTransferSchema,
  ReceiveStockTransferHeadersSchema,
  ReceiveStockTransferSchema,
  ShipStockTransferHeadersSchema,
  ShipStockTransferSchema,
  StockTransferIdParamsSchema,
  UpdateStockTransferSchema,
} from "@stock-management/shared";
import {
  assertCanPerform,
  listFilterFromContext,
} from "./branch-scope.js";

export type StockTransferRouteUseCases = {
  stockTransfers: StockTransferUseCases;
  shipStockTransfer: ShipStockTransfer;
  receiveStockTransfer: ReceiveStockTransfer;
  voidStockTransfer: VoidStockTransfer;
};

export function stockTransfersRoutes(
  useCases: StockTransferRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/stock-transfers", async (request) =>
      useCases.stockTransfers.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
    );

    app.get<{ Params: { id: string } }>(
      "/stock-transfers/:id",
      async (request) => {
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        return useCases.stockTransfers.get(request.ctx.orgId, id);
      },
    );

    app.post("/stock-transfers", async (request) => {
      assertCanPerform(
        request.ctx,
        "inventory.post",
        "Role cannot post inventory documents",
      );
      const body = CreateStockTransferSchema.parse(request.body);
      const transfer = await useCases.stockTransfers.create(
        request.ctx.orgId,
        body,
      );
      assertBranchAccess(
        { role: request.ctx.role, branchIds: request.ctx.branchIds },
        transfer.fromBranchId,
      );
      if (transfer.purpose === "replenishment") {
        assertBranchAccess(
          { role: request.ctx.role, branchIds: request.ctx.branchIds },
          transfer.toBranchId,
        );
      }
      return transfer;
    });

    app.patch<{ Params: { id: string } }>(
      "/stock-transfers/:id",
      async (request) => {
        assertCanPerform(
          request.ctx,
          "inventory.post",
          "Role cannot post inventory documents",
        );
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const body = UpdateStockTransferSchema.parse(request.body);
        const transfer = await useCases.stockTransfers.update(
          request.ctx.orgId,
          id,
          body,
        );
        assertBranchAccess(
          { role: request.ctx.role, branchIds: request.ctx.branchIds },
          transfer.fromBranchId,
        );
        if (transfer.purpose === "replenishment") {
          assertBranchAccess(
            { role: request.ctx.role, branchIds: request.ctx.branchIds },
            transfer.toBranchId,
          );
        }
        return transfer;
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-transfers/:id/ship",
      async (request) => {
        assertCanPerform(
          request.ctx,
          "inventory.post",
          "Role cannot post inventory documents",
        );
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const body = ShipStockTransferSchema.parse(request.body ?? {});
        const headerKey = ShipStockTransferHeadersSchema.parse(request.headers);
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.shipStockTransfer.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-transfers/:id/receive",
      async (request) => {
        assertCanPerform(
          request.ctx,
          "inventory.post",
          "Role cannot post inventory documents",
        );
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const body = ReceiveStockTransferSchema.parse(request.body ?? {});
        const headerKey = ReceiveStockTransferHeadersSchema.parse(
          request.headers,
        );
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.receiveStockTransfer.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-transfers/:id/void",
      async (request) => {
        assertCanPerform(
          request.ctx,
          "inventory.post",
          "Role cannot post inventory documents",
        );
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        return useCases.voidStockTransfer.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
