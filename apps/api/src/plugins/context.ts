import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { unauthorized } from "../lib/errors.js";

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
    throw unauthorized(`Missing required header: ${name}`);
  }
  return value.trim();
}

export const contextPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path === "/health") {
      return;
    }
    // Bootstrap: create org before client has an org id
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
