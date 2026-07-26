import type { FastifyPluginAsync } from "fastify";
import type { LocationUseCases } from "@stock-management/application";
import {
  CreateLocationSchema,
  UpdateLocationSchema,
  UuidSchema,
} from "@stock-management/shared";

export function locationsRoutes(useCases: LocationUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { branchId?: string } }>("/locations", async (request) => {
      const branchId = request.query.branchId
        ? UuidSchema.parse(request.query.branchId)
        : undefined;
      return useCases.list(request.ctx.orgId, branchId);
    });

    app.get<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/locations", async (request) => {
      const body = CreateLocationSchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateLocationSchema.parse(request.body);
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
