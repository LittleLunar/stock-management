import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "@stock-management/domain";

export type RequestContext = {
  orgId: string;
  userId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

function requireHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name.toLowerCase()];
  if (typeof value !== "string" || value.trim() === "") {
    throw new UnauthorizedError(`Missing required header: ${name}`);
  }
  return value.trim();
}

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path === "/health") {
      return;
    }
    if (request.method === "POST" && path === "/api/v1/orgs") {
      request.ctx = {
        orgId: "00000000-0000-0000-0000-000000000000",
        userId: requireHeader(request, "x-user-id"),
      };
      return;
    }
    request.ctx = {
      orgId: requireHeader(request, "x-org-id"),
      userId: requireHeader(request, "x-user-id"),
    };
  });
};

export const contextPlugin = fp(plugin, { name: "context" });
