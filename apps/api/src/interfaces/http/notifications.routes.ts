import type { FastifyPluginAsync } from "fastify";
import type { NotificationUseCases } from "@stock-management/application";
import type { Notification } from "@stock-management/domain";
import {
  NotificationListQuerySchema,
  PutNotificationPreferencesSchema,
  UuidSchema,
} from "@stock-management/shared";

function serializeNotification(n: Notification) {
  return {
    id: n.id,
    orgId: n.orgId,
    userId: n.userId,
    eventType: n.eventType,
    title: n.title,
    body: n.body,
    data: n.data,
    actions: n.actions,
    readAt: n.readAt?.toISOString() ?? null,
    dismissedAt: n.dismissedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function notificationsRoutes(
  useCases: NotificationUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/notifications", async (request) => {
      const query = NotificationListQuerySchema.parse(request.query ?? {});
      const rows = await useCases.list(
        request.ctx.orgId,
        request.ctx.userId,
        query,
      );
      return rows.map(serializeNotification);
    });

    app.get("/notifications/unread-count", async (request) => {
      const count = await useCases.unreadCount(
        request.ctx.orgId,
        request.ctx.userId,
      );
      return { count };
    });

    app.post("/notifications/read-all", async (request) => {
      const updated = await useCases.markAllRead(
        request.ctx.orgId,
        request.ctx.userId,
      );
      return { updated };
    });

    app.post<{ Params: { id: string } }>(
      "/notifications/:id/read",
      async (request) => {
        const id = UuidSchema.parse(request.params.id);
        await useCases.markRead(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
        return { ok: true };
      },
    );

    app.post<{ Params: { id: string } }>(
      "/notifications/:id/dismiss",
      async (request) => {
        const id = UuidSchema.parse(request.params.id);
        await useCases.dismiss(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
        return { ok: true };
      },
    );

    app.get("/notification-preferences", async (request) => {
      return useCases.getPreferences(
        request.ctx.orgId,
        request.ctx.userId,
      );
    });

    app.put("/notification-preferences", async (request) => {
      const body = PutNotificationPreferencesSchema.parse(request.body);
      const saved = await useCases.putPreferences(
        request.ctx.orgId,
        request.ctx.userId,
        body.preferences,
      );
      return saved;
    });
  };
}
