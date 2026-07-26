import type { FastifyPluginAsync } from "fastify";
import type { SupplierUseCases } from "@stock-management/application";
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  UuidSchema,
} from "@stock-management/shared";

export function suppliersRoutes(useCases: SupplierUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get("/suppliers", async (request) => useCases.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/suppliers/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/suppliers", async (request) => {
      const body = CreateSupplierSchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/suppliers/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateSupplierSchema.parse(request.body);
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
