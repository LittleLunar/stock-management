import type { FastifyPluginAsync } from "fastify";
import {
  CreateMembershipSchema,
  CreateUserSchema,
  UuidSchema,
} from "@stock-management/shared";
import type { UsersService } from "./users.service.js";

export function usersRoutes(service: UsersService): FastifyPluginAsync {
  return async (app) => {
    app.get("/users", async (request) => service.listUsers(request.ctx.orgId));

    app.post("/users", async (request) => {
      const body = CreateUserSchema.parse(request.body);
      return service.createUser(request.ctx.orgId, body);
    });

    app.get("/memberships", async (request) =>
      service.listMemberships(request.ctx.orgId),
    );

    app.post("/memberships", async (request) => {
      const body = CreateMembershipSchema.parse(request.body);
      return service.createMembership(request.ctx.orgId, body);
    });

    app.get<{ Params: { id: string } }>("/memberships/:id", async (request) => {
      const id = UuidSchema.parse(request.params.id);
      return service.getMembership(request.ctx.orgId, id);
    });
  };
}
