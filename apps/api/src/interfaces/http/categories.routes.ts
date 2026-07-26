import type { FastifyPluginAsync } from "fastify";
import type { CategoryUseCases } from "@stock-management/application";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  UuidSchema,
} from "@stock-management/shared";

export function categoriesRoutes(useCases: CategoryUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get("/categories", async (request) => useCases.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/categories/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/categories", async (request) => {
      const body = CreateCategorySchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/categories/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateCategorySchema.parse(request.body);
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
