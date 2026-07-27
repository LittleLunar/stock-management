import type { FastifyPluginAsync } from "fastify";
import { canPerform, ForbiddenError } from "@stock-management/domain";
import type { WebhookSubscriptionUseCases } from "@stock-management/application";
import {
  CreateWebhookSubscriptionSchema,
  UpdateWebhookSubscriptionSchema,
  UuidSchema,
} from "@stock-management/shared";

function assertWebhookAdmin(role: Parameters<typeof canPerform>[0]): void {
  if (!canPerform(role, "webhook.admin")) throw new ForbiddenError();
}

export function webhooksRoutes(
  useCases: WebhookSubscriptionUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/webhook-subscriptions", async (request) => {
      assertWebhookAdmin(request.ctx.role);
      return useCases.list(request.ctx.orgId);
    });

    app.post("/webhook-subscriptions", async (request, reply) => {
      assertWebhookAdmin(request.ctx.role);
      const body = CreateWebhookSubscriptionSchema.parse(request.body);
      const row = await useCases.create(request.ctx.orgId, body);
      return reply.code(201).send(row);
    });

    app.get<{ Params: { id: string } }>(
      "/webhook-subscriptions/:id",
      async (request) => {
        assertWebhookAdmin(request.ctx.role);
        const id = UuidSchema.parse(request.params.id);
        return useCases.get(request.ctx.orgId, id);
      },
    );

    app.patch<{ Params: { id: string } }>(
      "/webhook-subscriptions/:id",
      async (request) => {
        assertWebhookAdmin(request.ctx.role);
        const id = UuidSchema.parse(request.params.id);
        const body = UpdateWebhookSubscriptionSchema.parse(request.body);
        return useCases.update(request.ctx.orgId, id, body);
      },
    );

    app.get("/webhook-deliveries", async (request) => {
      assertWebhookAdmin(request.ctx.role);
      const q = request.query as { subscriptionId?: string };
      const subscriptionId = q.subscriptionId
        ? UuidSchema.parse(q.subscriptionId)
        : undefined;
      return useCases.listDeliveries(request.ctx.orgId, subscriptionId);
    });
  };
}
