import type { FastifyPluginAsync } from "fastify";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  UuidSchema,
} from "@stock-management/shared";
import type { CategoryService } from "./categories.service.js";

export function categoriesRoutes(service: CategoryService): FastifyPluginAsync {
  return async (app) => {
    app.get("/categories", async (request) => service.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/categories/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.get(request.ctx.orgId, id);
    });

    app.post("/categories", async (request) => {
      const body = CreateCategorySchema.parse(request.body);
      return service.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/categories/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateCategorySchema.parse(request.body);
      return service.update(request.ctx.orgId, id, body);
    });
  };
}
