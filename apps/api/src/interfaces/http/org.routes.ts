import type { FastifyPluginAsync } from "fastify";
import type { OrganizationUseCases } from "@stock-management/application";
import { UpdateOrganizationSchema, UuidSchema } from "@stock-management/shared";
import { z } from "zod";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(256),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).max(64).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

export function orgRoutes(useCases: OrganizationUseCases): FastifyPluginAsync {
  return async (app) => {
    app.post("/orgs", async (request) => {
      const body = CreateOrgSchema.parse(request.body);
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
