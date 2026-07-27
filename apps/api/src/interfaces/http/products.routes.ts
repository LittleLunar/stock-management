import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ProductUseCases } from "@stock-management/application";
import {
  CreateProductSchema,
  UpdateProductSchema,
  UuidSchema,
} from "@stock-management/shared";

export function productsRoutes(useCases: ProductUseCases): FastifyPluginAsync {
  return async (app) => {
    // Register before /products/:id so "by-barcode" is not captured as an id.
    app.get<{ Params: { code: string } }>(
      "/products/by-barcode/:code",
      async (request) => {
        const code = z.string().min(1).parse(request.params.code);
        return useCases.findByBarcode(
          request.ctx.orgId,
          decodeURIComponent(code),
        );
      },
    );

    app.get("/products", async (request) => useCases.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/products/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/products", async (request) => {
      const body = CreateProductSchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/products/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateProductSchema.parse(request.body);
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
