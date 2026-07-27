import type { FastifyPluginAsync } from "fastify";
import type {
  ActionTokenSigner,
  ExecuteNotificationAction,
  NotificationPublisher,
  NotificationUseCases,
} from "@stock-management/application";
import { pickEntityRef } from "@stock-management/application";
import type { Notification } from "@stock-management/domain";
import {
  ExecuteNotificationActionBodySchema,
  NotificationListQuerySchema,
  PutNotificationPreferencesSchema,
  UuidSchema,
} from "@stock-management/shared";

function serializeNotification(
  n: Notification,
  actionTokens?: ActionTokenSigner,
): Promise<Record<string, unknown>> | Record<string, unknown> {
  const base = {
    id: n.id,
    orgId: n.orgId,
    userId: n.userId,
    eventType: n.eventType,
    title: n.title,
    body: n.body,
    data: n.data,
    readAt: n.readAt?.toISOString() ?? null,
    dismissedAt: n.dismissedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };

  if (!actionTokens) {
    return { ...base, actions: n.actions };
  }

  const entityRef = pickEntityRef(n.data.entityIds ?? {}, n.eventType);
  return Promise.all(
    n.actions.map(async (action) => {
      if (action.kind !== "server" || !entityRef) return action;
      const token = await actionTokens.sign({
        notificationId: n.id,
        actionId: action.id,
        userId: n.userId,
        orgId: n.orgId,
        entityRef,
      });
      return { ...action, token };
    }),
  ).then((actions) => ({ ...base, actions }));
}

export function notificationsRoutes(
  useCases: NotificationUseCases,
  options?: { actionTokens?: ActionTokenSigner },
): FastifyPluginAsync {
  return async (app) => {
    app.get("/notifications", async (request) => {
      const query = NotificationListQuerySchema.parse(request.query ?? {});
      const rows = await useCases.list(
        request.ctx.orgId,
        request.ctx.userId,
        query,
      );
      return Promise.all(
        rows.map((n) => serializeNotification(n, options?.actionTokens)),
      );
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

export function notificationActionRoutes(
  execute: ExecuteNotificationAction,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/notification-actions/execute", async (request) => {
      const body = ExecuteNotificationActionBodySchema.parse(request.body);
      return execute.execute(body);
    });
  };
}

export function notificationWsRoutes(options: {
  accessTokens: { verify(token: string): Promise<{ sub: string; email: string }> };
  hub: NotificationPublisher & {
    subscribe(userId: string, orgId: string, socket: import("ws").WebSocket): void;
  };
  membershipAccess: {
    findActiveByUser(
      orgId: string,
      userId: string,
    ): Promise<{ orgId: string } | null>;
  };
}): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/notifications/ws",
      { websocket: true },
      async (socket, request) => {
        const query = request.query as {
          access_token?: string;
          orgId?: string;
        };
        const token =
          typeof query.access_token === "string" ? query.access_token.trim() : "";
        const orgId =
          typeof query.orgId === "string" ? query.orgId.trim() : "";

        if (!token || !orgId) {
          socket.close(4401, "Unauthorized");
          return;
        }

        let userId: string;
        try {
          const claims = await options.accessTokens.verify(token);
          userId = claims.sub;
        } catch {
          socket.close(4401, "Unauthorized");
          return;
        }

        const membership = await options.membershipAccess.findActiveByUser(
          orgId,
          userId,
        );
        if (!membership) {
          socket.close(4403, "Forbidden");
          return;
        }

        options.hub.subscribe(userId, orgId, socket);
        socket.send(JSON.stringify({ type: "connected", userId, orgId }));
      },
    );
  };
}
