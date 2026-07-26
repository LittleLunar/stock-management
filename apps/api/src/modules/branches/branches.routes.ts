import type { FastifyPluginAsync } from "fastify";
import {
  CreateBranchSchema,
  UpdateBranchSchema,
  UuidSchema,
} from "@stock-management/shared";
import type { BranchService } from "./branches.service.js";

export function branchesRoutes(service: BranchService): FastifyPluginAsync {
  return async (app) => {
    app.get("/branches", async (request) => {
      return service.list(request.ctx.orgId);
    });

    app.get<{ Params: { id: string } }>("/branches/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.get(request.ctx.orgId, id);
    });

    app.post("/branches", async (request) => {
      const body = CreateBranchSchema.parse(request.body);
      return service.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/branches/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateBranchSchema.parse(request.body);
      return service.update(request.ctx.orgId, id, body);
    });
  };
}
