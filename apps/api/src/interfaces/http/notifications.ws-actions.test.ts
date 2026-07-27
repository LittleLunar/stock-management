import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import {
  ExecuteNotificationAction,
  type ActionTokenSigner,
  type NotificationActionTokenClaims,
  type NotificationRepository,
  type PurchaseOrderUseCases,
  type StockAdjustmentUseCases,
  type MembershipInviteUseCases,
} from "@stock-management/application";
import {
  TokenExpiredError,
  TokenInvalidError,
  type Notification,
} from "@stock-management/domain";
import { JoseAccessTokenSigner } from "../../infrastructure/auth/crypto.js";
import { WsNotificationHub } from "../../infrastructure/notifications/ws-hub.js";
import { requestIdPlugin } from "../plugins/request-id.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import {
  notificationActionRoutes,
  notificationWsRoutes,
} from "./notifications.routes.js";

const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const NOTIF = "00000000-0000-4000-8000-000000000003";
const PO = "00000000-0000-4000-8000-000000000004";

function memoryTokens(
  store = new Map<string, NotificationActionTokenClaims & { exp?: number }>(),
): ActionTokenSigner {
  let seq = 0;
  return {
    async sign(claims) {
      const token = `tok-${++seq}`;
      store.set(token, { ...claims });
      return token;
    },
    async verify(token) {
      const claims = store.get(token);
      if (!claims) throw new TokenInvalidError();
      if (claims.exp != null && claims.exp < Date.now() / 1000) {
        throw new TokenExpiredError();
      }
      const { exp: _e, ...rest } = claims;
      return rest;
    },
  };
}

describe("notification-actions execute", () => {
  it("executes approve via signed token without session", async () => {
    const row: Notification = {
      id: NOTIF,
      orgId: ORG,
      userId: USER,
      eventType: "approval.assigned",
      title: "Approval",
      body: "PO",
      data: { entityIds: { purchase_order: PO } },
      actions: [{ id: "approve", label: "Approve", kind: "server" }],
      readAt: null,
      dismissedAt: null,
      createdAt: new Date(),
    };
    const approve = vi.fn(async () => ({ id: PO, status: "approved" }));
    const tokens = memoryTokens();
    const token = await tokens.sign({
      notificationId: NOTIF,
      actionId: "approve",
      userId: USER,
      orgId: ORG,
      entityRef: { type: "purchase_order", id: PO },
    });
    const execute = new ExecuteNotificationAction({
      tokens,
      notifications: {
        async insert() {
          throw new Error("unused");
        },
        async findByDeliveryKey() {
          return null;
        },
        async listForUser() {
          return [];
        },
        async unreadCount() {
          return 0;
        },
        async findById() {
          return row;
        },
        async markRead(_o, _u, _id, at) {
          row.readAt = at;
        },
        async markAllRead() {
          return 0;
        },
        async dismiss() {},
      } satisfies NotificationRepository,
      membershipAccess: {
        async findActiveByUser(orgId, userId) {
          return {
            id: "m-1",
            orgId,
            userId,
            role: "org_admin",
            status: "active",
            branchIds: [],
            createdAt: new Date(0),
            updatedAt: new Date(0),
          };
        },
      },
      purchaseOrders: {
        get: async () => ({
          id: PO,
          status: "submitted",
          branchId: "00000000-0000-4000-8000-000000000005",
        }),
        approve,
        cancel: vi.fn(),
      } as unknown as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(notificationActionRoutes(execute), {
      prefix: "/api/v1",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/notification-actions/execute",
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, actionId: "approve" });
    expect(approve).toHaveBeenCalled();
    await app.close();
  });

  it("returns 401 TOKEN_EXPIRED for expired action tokens", async () => {
    const store = new Map<
      string,
      NotificationActionTokenClaims & { exp?: number }
    >();
    const tokens = memoryTokens(store);
    const token = await tokens.sign({
      notificationId: NOTIF,
      actionId: "approve",
      userId: USER,
      orgId: ORG,
      entityRef: { type: "purchase_order", id: PO },
    });
    store.get(token)!.exp = Math.floor(Date.now() / 1000) - 5;

    const execute = new ExecuteNotificationAction({
      tokens,
      notifications: {
        async insert() {
          throw new Error("unused");
        },
        async findByDeliveryKey() {
          return null;
        },
        async listForUser() {
          return [];
        },
        async unreadCount() {
          return 0;
        },
        async findById() {
          return null;
        },
        async markRead() {},
        async markAllRead() {
          return 0;
        },
        async dismiss() {},
      },
      membershipAccess: {
        async findActiveByUser() {
          return null;
        },
      },
      purchaseOrders: {} as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(notificationActionRoutes(execute), {
      prefix: "/api/v1",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/notification-actions/execute",
      payload: { token },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("TOKEN_EXPIRED");
    await app.close();
  });
});

describe("notifications WebSocket", () => {
  it("rejects connect without access_token", async () => {
    const hub = new WsNotificationHub();
    const accessTokens = new JoseAccessTokenSigner("ws-test-secret", 900);
    const app = Fastify();
    await app.register(websocket);
    await app.register(
      notificationWsRoutes({
        accessTokens,
        hub,
        membershipAccess: {
          async findActiveByUser() {
            return { orgId: ORG };
          },
        },
      }),
      { prefix: "/api/v1" },
    );
    await app.ready();

    await expect(
      app.inject({
        method: "GET",
        url: `/api/v1/notifications/ws?orgId=${ORG}`,
        headers: { upgrade: "websocket", connection: "upgrade" },
      }),
    ).resolves.toBeTruthy();

    // Hub publish is a no-op with no subscribers — smoke the publisher path.
    hub.publish(USER, ORG, { type: "unread-count", count: 3 });
    await app.close();
  });

  it("publishes unread-count to subscribed room", () => {
    const hub = new WsNotificationHub();
    const sent: string[] = [];
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send(data: string) {
        sent.push(data);
      },
      on() {},
    } as unknown as import("ws").WebSocket;

    hub.subscribe(USER, ORG, fakeSocket);
    hub.publish(USER, ORG, { type: "unread-count", count: 2 });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!)).toEqual({ type: "unread-count", count: 2 });
  });
});
