import type { FastifyPluginAsync } from "fastify";
import type {
  GoodsReceiptUseCases,
  PostGoodsReceipt,
  VoidGoodsReceipt,
} from "@stock-management/application";
import {
  CreateGoodsReceiptSchema,
  GoodsReceiptIdParamsSchema,
  PostGoodsReceiptHeadersSchema,
  PostGoodsReceiptSchema,
  UpdateGoodsReceiptSchema,
} from "@stock-management/shared";
import {
  assertDocumentBranchWrite,
  listFilterFromContext,
} from "./branch-scope.js";

export type GoodsReceiptRouteUseCases = {
  goodsReceipts: GoodsReceiptUseCases;
  postGoodsReceipt: PostGoodsReceipt;
  voidGoodsReceipt: VoidGoodsReceipt;
};

export function goodsReceiptsRoutes(
  useCases: GoodsReceiptRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/goods-receipts", async (request) =>
      useCases.goodsReceipts.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
    );

    app.get<{ Params: { id: string } }>(
      "/goods-receipts/:id",
      async (request) => {
        const { id } = GoodsReceiptIdParamsSchema.parse(request.params);
        return useCases.goodsReceipts.get(request.ctx.orgId, id);
      },
    );

    app.post("/goods-receipts", async (request) => {
      const body = CreateGoodsReceiptSchema.parse(request.body);
      assertDocumentBranchWrite(
        request.ctx,
        "inventory.post",
        body.branchId,
        "Role cannot post inventory documents",
      );
      return useCases.goodsReceipts.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/goods-receipts/:id",
      async (request) => {
        const { id } = GoodsReceiptIdParamsSchema.parse(request.params);
        const body = UpdateGoodsReceiptSchema.parse(request.body);
        const existing = await useCases.goodsReceipts.get(
          request.ctx.orgId,
          id,
        );
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          body.branchId ?? existing.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.goodsReceipts.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/goods-receipts/:id/post",
      async (request) => {
        const { id } = GoodsReceiptIdParamsSchema.parse(request.params);
        const doc = await useCases.goodsReceipts.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        const body = PostGoodsReceiptSchema.parse(request.body ?? {});
        const headerKey = PostGoodsReceiptHeadersSchema.parse(request.headers);
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postGoodsReceipt.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/goods-receipts/:id/void",
      async (request) => {
        const { id } = GoodsReceiptIdParamsSchema.parse(request.params);
        const doc = await useCases.goodsReceipts.get(request.ctx.orgId, id);
        assertDocumentBranchWrite(
          request.ctx,
          "inventory.post",
          doc.branchId,
          "Role cannot post inventory documents",
        );
        return useCases.voidGoodsReceipt.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
