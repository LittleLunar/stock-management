import type { FastifyPluginAsync } from "fastify";
import type { OrganizationUseCases } from "@stock-management/application";
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  UuidSchema,
} from "@stock-management/shared";

export function orgRoutes(useCases: OrganizationUseCases): FastifyPluginAsync {
  return async (app) => {
    app.post("/orgs", async (request) => {
      const body = CreateOrganizationSchema.parse(request.body);
      return useCases.create(body);
    });

    app.get<{ Params: { orgId: string } }>("/orgs/:orgId", async (request) => {
      const orgId = UuidSchema.parse(request.params.orgId);
      return useCases.get(request.ctx.orgId, orgId);
    });

    app.patch<{ Params: { orgId: string } }>("/orgs/:orgId", async (request) => {
      const orgId = UuidSchema.parse(request.params.orgId);
      const body = UpdateOrganizationSchema.parse(request.body);
      return useCases.update(request.ctx.orgId, orgId, body);
    });
  };
}
