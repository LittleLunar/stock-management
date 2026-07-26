import type { FastifyPluginAsync } from "fastify";
import type { UsersUseCases } from "@stock-management/application";
import {
  CreateMembershipSchema,
  CreateUserSchema,
  UuidSchema,
} from "@stock-management/shared";

export function usersRoutes(useCases: UsersUseCases): FastifyPluginAsync {
  return async (app) => {
    app.get("/users", async (request) => useCases.listUsers(request.ctx.orgId));

    app.post("/users", async (request) => {
      const body = CreateUserSchema.parse(request.body);
      return useCases.createUser(request.ctx.orgId, body);
    });

    app.get("/memberships", async (request) =>
      useCases.listMemberships(request.ctx.orgId),
    );

    app.post("/memberships", async (request) => {
      const body = CreateMembershipSchema.parse(request.body);
      return useCases.createMembership(request.ctx.orgId, body);
    });

    app.get<{ Params: { id: string } }>("/memberships/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return useCases.getMembership(request.ctx.orgId, id);
    });
  };
}
