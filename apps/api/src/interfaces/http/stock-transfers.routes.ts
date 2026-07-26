import type { FastifyPluginAsync } from "fastify";
import type {
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockTransferUseCases,
  VoidStockTransfer,
} from "@stock-management/application";
import type { MembershipAccess } from "@stock-management/domain";
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
import type { RequestContext } from "../plugins/context.js";
import {
  assertCanPerform,
  assertDocumentBranchWrite,
  assertTransferBranchRead,
  listFilterFromContext,
} from "./branch-scope.js";

export type StockTransferRouteUseCases = {
  stockTransfers: StockTransferUseCases;
  shipStockTransfer: ShipStockTransfer;
  receiveStockTransfer: ReceiveStockTransfer;
  voidStockTransfer: VoidStockTransfer;
};

function membershipAccessFromCtx(
  ctx: Pick<RequestContext, "role" | "branchIds">,
): MembershipAccess {
  return { role: ctx.role, branchIds: ctx.branchIds };
}

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
        const transfer = await useCases.stockTransfers.get(
          request.ctx.orgId,
          id,
        );
        assertTransferBranchRead(
          request.ctx,
          transfer.fromBranchId,
          transfer.toBranchId,
        );
        return transfer;
      },
    );

    app.post("/stock-transfers", async (request) => {
      assertCanPerform(
        request.ctx,
        "inventory.post",
        "Role cannot post inventory documents",
      );
      const body = CreateStockTransferSchema.parse(request.body);
      return useCases.stockTransfers.create(
        request.ctx.orgId,
        body,
        membershipAccessFromCtx(request.ctx),
      );
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
        return useCases.stockTransfers.update(
          request.ctx.orgId,
          id,
          body,
          membershipAccessFromCtx(request.ctx),
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/stock-transfers/:id/ship",
      async (request) => {
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const transfer = await useCases.stockTransfers.get(
          request.ctx.orgId,
          id,
        );
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          transfer.fromBranchId,
          "Role cannot post inventory documents",
        );
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
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const transfer = await useCases.stockTransfers.get(
          request.ctx.orgId,
          id,
        );
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          transfer.toBranchId,
          "Role cannot post inventory documents",
        );
        // Replenishment create requires both ends; receive keeps the same grant.
        if (transfer.purpose === "replenishment") {
          assertBranchAccess(
            membershipAccessFromCtx(request.ctx),
            transfer.fromBranchId,
          );
        }
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
        const { id } = StockTransferIdParamsSchema.parse(request.params);
        const transfer = await useCases.stockTransfers.get(
          request.ctx.orgId,
          id,
        );
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          transfer.fromBranchId,
          "Role cannot post inventory documents",
        );
        return useCases.voidStockTransfer.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
