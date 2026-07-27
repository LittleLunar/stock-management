import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  assertCanApproveAdjustment,
  assertCanApprovePo,
  type Notification,
} from "@stock-management/domain";
import type {
  ActionTokenSigner,
  NotificationPublisher,
  NotificationRepository,
} from "../ports/notification.js";
import type { MembershipInviteUseCases } from "./membership-invite.js";
import type { PurchaseOrderUseCases } from "./purchase-order.js";
import type { StockAdjustmentUseCases } from "./stock-adjustment.js";

export type ExecuteNotificationActionResult = {
  notificationId: string;
  actionId: string;
  ok: true;
};

export type ExecuteNotificationActionDeps = {
  tokens: ActionTokenSigner;
  notifications: NotificationRepository;
  publisher?: NotificationPublisher;
  purchaseOrders: PurchaseOrderUseCases;
  stockAdjustments: StockAdjustmentUseCases;
  membershipInvites: MembershipInviteUseCases;
};

/**
 * Verifies a signed notification action token and dispatches to the target
 * use case (approval approve/reject, invite accept/decline).
 */
export class ExecuteNotificationAction {
  constructor(private readonly deps: ExecuteNotificationActionDeps) {}

  async execute(input: {
    token: string;
    /** Required for invite accept (creates the invitee user). */
    name?: string;
    password?: string;
  }): Promise<ExecuteNotificationActionResult> {
    const claims = await this.deps.tokens.verify(input.token);
    const notification = await this.deps.notifications.findById(
      claims.orgId,
      claims.userId,
      claims.notificationId,
    );
    if (!notification) {
      throw new NotFoundError("Notification");
    }
    if (notification.userId !== claims.userId) {
      throw new ForbiddenError("Action token recipient mismatch");
    }

    const action = notification.actions.find((a) => a.id === claims.actionId);
    if (!action || action.kind !== "server") {
      throw new InvalidStateError(`Unknown server action: ${claims.actionId}`);
    }

    await this.dispatch(claims.actionId, claims, notification, input);

    if (!notification.readAt) {
      await this.deps.notifications.markRead(
        claims.orgId,
        claims.userId,
        claims.notificationId,
        new Date(),
      );
      this.deps.publisher?.publish(claims.userId, claims.orgId, {
        type: "notification.read",
        id: claims.notificationId,
      });
      const count = await this.deps.notifications.unreadCount(
        claims.orgId,
        claims.userId,
      );
      this.deps.publisher?.publish(claims.userId, claims.orgId, {
        type: "unread-count",
        count,
      });
    }

    return {
      notificationId: claims.notificationId,
      actionId: claims.actionId,
      ok: true,
    };
  }

  private async dispatch(
    actionId: string,
    claims: {
      orgId: string;
      entityRef: { type: string; id: string };
    },
    notification: Notification,
    input: { name?: string; password?: string },
  ): Promise<void> {
    const { type, id } = claims.entityRef;

    if (actionId === "approve" || actionId === "reject") {
      if (type === "purchase_order") {
        if (actionId === "approve") {
          const po = await this.deps.purchaseOrders.get(claims.orgId, id);
          // Idempotent: already approved is OK.
          if (po.status === "approved") return;
          assertCanApprovePo(po);
          await this.deps.purchaseOrders.approve(claims.orgId, id);
          return;
        }
        const po = await this.deps.purchaseOrders.get(claims.orgId, id);
        if (po.status === "cancelled") return;
        await this.deps.purchaseOrders.cancel(claims.orgId, id);
        return;
      }
      if (type === "stock_adjustment") {
        if (actionId === "approve") {
          const adj = await this.deps.stockAdjustments.get(claims.orgId, id);
          if (adj.status === "approved") return;
          assertCanApproveAdjustment(adj);
          await this.deps.stockAdjustments.approve(claims.orgId, id);
          return;
        }
        const adj = await this.deps.stockAdjustments.get(claims.orgId, id);
        if (adj.status === "draft") return;
        await this.deps.stockAdjustments.reject(claims.orgId, id);
        return;
      }
      throw new InvalidStateError(`Unsupported approval entity: ${type}`);
    }

    if (actionId === "accept" || actionId === "decline") {
      if (type !== "membership_invite") {
        throw new InvalidStateError(`Unsupported invite entity: ${type}`);
      }
      if (actionId === "decline") {
        await this.deps.membershipInvites.declineInviteById(id);
        return;
      }
      if (!input.name?.trim() || !input.password) {
        throw new InvalidStateError(
          "Invite accept requires name and password",
        );
      }
      await this.deps.membershipInvites.acceptInviteById({
        inviteId: id,
        name: input.name,
        password: input.password,
      });
      return;
    }

    void notification;
    throw new InvalidStateError(`Unsupported action: ${actionId}`);
  }
}
