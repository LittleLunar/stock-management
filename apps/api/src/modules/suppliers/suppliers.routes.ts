import type { FastifyPluginAsync } from "fastify";
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  UuidSchema,
} from "@stock-management/shared";
import type { SupplierService } from "./suppliers.service.js";

export function suppliersRoutes(service: SupplierService): FastifyPluginAsync {
  return async (app) => {
    app.get("/suppliers", async (request) => service.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/suppliers/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.get(request.ctx.orgId, id);
    });

    app.post("/suppliers", async (request) => {
      const body = CreateSupplierSchema.parse(request.body);
      return service.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/suppliers/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateSupplierSchema.parse(request.body);
      return service.update(request.ctx.orgId, id, body);
    });
  };
}
