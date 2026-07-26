import type { FastifyPluginAsync } from "fastify";
import {
  CreateProductSchema,
  UpdateProductSchema,
  UuidSchema,
} from "@stock-management/shared";
import type { ProductService } from "./products.service.js";

export function productsRoutes(service: ProductService): FastifyPluginAsync {
  return async (app) => {
    app.get("/products", async (request) => service.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/products/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.get(request.ctx.orgId, id);
    });

    app.post("/products", async (request) => {
      const body = CreateProductSchema.parse(request.body);
      return service.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/products/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateProductSchema.parse(request.body);
      return service.update(request.ctx.orgId, id, body);
    });
  };
}
