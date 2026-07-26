import type { FastifyPluginAsync } from "fastify";
import type { LocationUseCases } from "@stock-management/application";
import {
  CreateLocationSchema,
  UpdateLocationSchema,
  UuidSchema,
} from "@stock-management/shared";
import { assertDocumentBranchWrite } from "./branch-scope.js";

export function locationsRoutes(useCases: LocationUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { branchId?: string } }>("/locations", async (request) => {
      const queryBranchId = request.query.branchId
        ? UuidSchema.parse(request.query.branchId)
        : undefined;
      // Branch-scoped (or HQ acting as branch): force active branch; ignore query widen.
      const branchId =
        request.ctx.activeBranchId ?? queryBranchId ?? undefined;
      return useCases.list(request.ctx.orgId, branchId);
    });

    app.get<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.get(request.ctx.orgId, id);
    });

    app.post("/locations", async (request) => {
      const body = CreateLocationSchema.parse(request.body);
      assertDocumentBranchWrite(
        request.ctx,
        "masters.write",
        body.branchId,
        "Role cannot write masters",
      );
      return useCases.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>("/locations/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      const body = UpdateLocationSchema.parse(request.body);
      const existing = await useCases.get(request.ctx.orgId, id);
      assertDocumentBranchWrite(
        request.ctx,
        "masters.write",
        existing.branchId,
        "Role cannot write masters",
      );
      return useCases.update(request.ctx.orgId, id, body);
    });
  };
}
