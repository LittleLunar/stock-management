import type { FastifyPluginAsync } from "fastify";
import type {
  CustomerReturnUseCases,
  PostCustomerReturn,
  VoidCustomerReturn,
} from "@stock-management/application";
import {
  CreateCustomerReturnSchema,
  CustomerReturnIdParamsSchema,
  PostCustomerReturnHeadersSchema,
  PostCustomerReturnSchema,
  UpdateCustomerReturnSchema,
} from "@stock-management/shared";

export type CustomerReturnRouteUseCases = {
  customerReturns: CustomerReturnUseCases;
  postCustomerReturn: PostCustomerReturn;
  voidCustomerReturn: VoidCustomerReturn;
};

export function customerReturnsRoutes(
  useCases: CustomerReturnRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/customer-returns", async (request) =>
      useCases.customerReturns.list(request.ctx.orgId),
    );

    app.get<{ Params: { id: string } }>(
      "/customer-returns/:id",
      async (request) => {
        const { id } = CustomerReturnIdParamsSchema.parse(request.params);
        return useCases.customerReturns.get(request.ctx.orgId, id);
      },
    );

    app.post("/customer-returns", async (request) => {
      const body = CreateCustomerReturnSchema.parse(request.body);
      return useCases.customerReturns.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/customer-returns/:id",
      async (request) => {
        const { id } = CustomerReturnIdParamsSchema.parse(request.params);
        const body = UpdateCustomerReturnSchema.parse(request.body);
        return useCases.customerReturns.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/customer-returns/:id/post",
      async (request) => {
        const { id } = CustomerReturnIdParamsSchema.parse(request.params);
        const body = PostCustomerReturnSchema.parse(request.body ?? {});
        const headerKey = PostCustomerReturnHeadersSchema.parse(
          request.headers,
        );
        const externalSystem =
          body.external_system ?? headerKey.external_system;
        const externalId = body.external_id ?? headerKey.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postCustomerReturn.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/customer-returns/:id/void",
      async (request) => {
        const { id } = CustomerReturnIdParamsSchema.parse(request.params);
        return useCases.voidCustomerReturn.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
