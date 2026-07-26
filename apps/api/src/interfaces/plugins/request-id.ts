import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

const HEADER = "x-request-id";

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.id;
    reply.header(HEADER, request.id);
    request.log = request.log.child({ requestId: request.id });
  });
};

export const requestIdPlugin = fp(plugin, { name: "request-id" });
