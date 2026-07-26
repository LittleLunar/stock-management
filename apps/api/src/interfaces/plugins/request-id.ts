import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

const HEADER = "x-request-id";

export const requestIdPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.id;
    reply.header(HEADER, request.id);
    request.log = request.log.child({ requestId: request.id });
  });
};
