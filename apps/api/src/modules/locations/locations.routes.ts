import type { FastifyPluginAsync } from "fastify";
import {
  CreateLocationSchema,
  UpdateLocationSchema,
  UuidSchema,
} from "@stock-management/shared";
import type { LocationService } from "./locations.service.js";

export function locationsRoutes(service: LocationService): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { branchId?: string } }>("/locations", async (request) => {
      const branchId = request.query.branchId
        ? UuidSchema.parse(request.query.branchId)
        : undefined;
      return service.list(request.ctx.orgId, branchId);
    });

    app.get<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.get(request.ctx.orgId, id);
    });

    app.post("/locations", async (request) => {
      const body = CreateLocationSchema.parse(request.body);
      return service.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateLocationSchema.parse(request.body);
      return service.update(request.ctx.orgId, id, body);
    });
  };
}
