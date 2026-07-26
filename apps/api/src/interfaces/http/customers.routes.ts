import type { FastifyPluginAsync } from "fastify";
import type { CustomerUseCases } from "@stock-management/application";
import { CreateCustomerSchema } from "@stock-management/shared";

export function customersRoutes(useCases: CustomerUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get("/customers", async (request) => useCases.list(request.ctx.orgId));

    app.post("/customers", async (request) => {
      const body = CreateCustomerSchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });
  };
}
