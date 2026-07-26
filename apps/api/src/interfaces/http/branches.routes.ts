import type { FastifyPluginAsync } from "fastify";
import type { BranchUseCases } from "@stock-management/application";
import {
  CreateBranchSchema,
  UpdateBranchSchema,
  UuidSchema,
} from "@stock-management/shared";

export function branchesRoutes(useCases: BranchUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get("/branches", async (request) => useCases.list(request.ctx.orgId));

    app.get<{ Params: { id: string } }>("/branches/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/branches", async (request) => {
      const body = CreateBranchSchema.parse(request.body);
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/branches/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateBranchSchema.parse(request.body);
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
