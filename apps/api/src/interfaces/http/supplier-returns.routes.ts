import type { FastifyPluginAsync } from "fastify";
import type {
  PostSupplierReturn,
  SupplierReturnUseCases,
  VoidSupplierReturn,
} from "@stock-management/application";
import {
  CreateSupplierReturnSchema,
  PostSupplierReturnHeadersSchema,
  PostSupplierReturnSchema,
  SupplierReturnIdParamsSchema,
  UpdateSupplierReturnSchema,
} from "@stock-management/shared";

export type SupplierReturnRouteUseCases = {
  supplierReturns: SupplierReturnUseCases;
  postSupplierReturn: PostSupplierReturn;
  voidSupplierReturn: VoidSupplierReturn;
};

export function supplierReturnsRoutes(
  useCases: SupplierReturnRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/supplier-returns", async (request) =>
      useCases.supplierReturns.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>(
      "/supplier-returns/:id",
      async (request) => {
        const { id } = SupplierReturnIdParamsSchema.parse(request.params);
        return useCases.supplierReturns.get(request.ctx.orgId, id);
      },
    );

    app.post("/supplier-returns", async (request) => {
      const body = CreateSupplierReturnSchema.parse(request.body);
      return useCases.supplierReturns.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/supplier-returns/:id",
      async (request) => {
        const { id } = SupplierReturnIdParamsSchema.parse(request.params);
        const body = UpdateSupplierReturnSchema.parse(request.body);
        return useCases.supplierReturns.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/supplier-returns/:id/post",
      async (request) => {
        const { id } = SupplierReturnIdParamsSchema.parse(request.params);
        const body = PostSupplierReturnSchema.parse(request.body ?? {});
        const headerKey = PostSupplierReturnHeadersSchema.parse(
          request.headers,
        );
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postSupplierReturn.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/supplier-returns/:id/void",
      async (request) => {
        const { id } = SupplierReturnIdParamsSchema.parse(request.params);
        return useCases.voidSupplierReturn.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
