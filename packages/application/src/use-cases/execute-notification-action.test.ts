import { describe, expect, it, vi } from "vitest";
import {
  InvalidStateError,
  TokenExpiredError,
  TokenInvalidError,
  type Notification,
} from "@stock-management/domain";
import { ExecuteNotificationAction } from "./execute-notification-action.js";
import type {
  ActionTokenSigner,
  NotificationActionTokenClaims,
  NotificationRepository,
} from "../ports/notification.js";
import type { PurchaseOrderUseCases } from "./purchase-order.js";
import type { StockAdjustmentUseCases } from "./stock-adjustment.js";
import type { MembershipInviteUseCases } from "./membership-invite.js";

const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const NOTIF = "00000000-0000-4000-8000-000000000003";
const PO = "00000000-0000-4000-8000-000000000004";

function notification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: NOTIF,
    orgId: ORG,
    userId: USER,
    eventType: "approval.assigned",
    title: "Approval needed",
    body: "PO needs approval",
    data: { entityIds: { purchase_order: PO } },
    actions: [
      { id: "approve", label: "Approve", kind: "server" },
      { id: "reject", label: "Reject", kind: "server" },
    ],
    readAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function memoryTokens(
  store: Map<string, NotificationActionTokenClaims & { exp?: number }> = new Map(),
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
      const { exp: _exp, ...rest } = claims;
      return rest;
    },
  };
}

describe("ExecuteNotificationAction", () => {
  it("approves a purchase order and marks the notification read", async () => {
    const row = notification();
    const notifications: NotificationRepository = {
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
      async markRead(_o, _u, id, at) {
        row.readAt = at;
        expect(id).toBe(NOTIF);
      },
      async markAllRead() {
        return 0;
      },
      async dismiss() {},
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

    const uc = new ExecuteNotificationAction({
      tokens,
      notifications,
      purchaseOrders: {
        get: async () => ({ id: PO, status: "submitted" }),
        approve,
        cancel: vi.fn(),
      } as unknown as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    const result = await uc.execute({ token });
    expect(result).toEqual({
      notificationId: NOTIF,
      actionId: "approve",
      ok: true,
    });
    expect(approve).toHaveBeenCalledWith(ORG, PO);
    expect(row.readAt).not.toBeNull();
  });

  it("is idempotent when the PO is already approved", async () => {
    const row = notification();
    const approve = vi.fn();
    const tokens = memoryTokens();
    const token = await tokens.sign({
      notificationId: NOTIF,
      actionId: "approve",
      userId: USER,
      orgId: ORG,
      entityRef: { type: "purchase_order", id: PO },
    });
    const uc = new ExecuteNotificationAction({
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
      },
      purchaseOrders: {
        get: async () => ({ id: PO, status: "approved" }),
        approve,
        cancel: vi.fn(),
      } as unknown as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    await uc.execute({ token });
    expect(approve).not.toHaveBeenCalled();
  });

  it("maps expired action tokens to TokenExpiredError", async () => {
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
    store.get(token)!.exp = Math.floor(Date.now() / 1000) - 10;

    const uc = new ExecuteNotificationAction({
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
          return notification();
        },
        async markRead() {},
        async markAllRead() {
          return 0;
        },
        async dismiss() {},
      },
      purchaseOrders: {} as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    await expect(uc.execute({ token })).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it("maps invalid action tokens to TokenInvalidError", async () => {
    const uc = new ExecuteNotificationAction({
      tokens: memoryTokens(),
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
      purchaseOrders: {} as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    await expect(uc.execute({ token: "bogus" })).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
  });

  it("declines an invite by entity id", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000099";
    const row = notification({
      eventType: "membership.invite_received",
      data: { entityIds: { membership_invite: inviteId } },
      actions: [
        { id: "accept", label: "Accept", kind: "server" },
        { id: "decline", label: "Decline", kind: "server" },
      ],
    });
    const declineInviteById = vi.fn(async () => ({ inviteId }));
    const tokens = memoryTokens();
    const token = await tokens.sign({
      notificationId: NOTIF,
      actionId: "decline",
      userId: USER,
      orgId: ORG,
      entityRef: { type: "membership_invite", id: inviteId },
    });

    const uc = new ExecuteNotificationAction({
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
      },
      purchaseOrders: {} as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {
        declineInviteById,
      } as unknown as MembershipInviteUseCases,
    });

    await uc.execute({ token });
    expect(declineInviteById).toHaveBeenCalledWith(inviteId);
  });

  it("requires name and password for invite accept", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000099";
    const row = notification({
      eventType: "membership.invite_received",
      data: { entityIds: { membership_invite: inviteId } },
      actions: [{ id: "accept", label: "Accept", kind: "server" }],
    });
    const tokens = memoryTokens();
    const token = await tokens.sign({
      notificationId: NOTIF,
      actionId: "accept",
      userId: USER,
      orgId: ORG,
      entityRef: { type: "membership_invite", id: inviteId },
    });
    const uc = new ExecuteNotificationAction({
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
        async markRead() {},
        async markAllRead() {
          return 0;
        },
        async dismiss() {},
      },
      purchaseOrders: {} as PurchaseOrderUseCases,
      stockAdjustments: {} as StockAdjustmentUseCases,
      membershipInvites: {} as MembershipInviteUseCases,
    });

    await expect(uc.execute({ token })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });
});
