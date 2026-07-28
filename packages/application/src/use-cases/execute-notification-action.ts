import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  assertBranchAccess,
  assertCanApproveAdjustment,
  assertCanApprovePo,
  canPerform,
  type Notification,
} from "@stock-management/domain";
import type { MembershipAccessPort } from "../ports/membership-access.js";
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
  membershipAccess: MembershipAccessPort;
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

  private async assertDocumentApprove(
    orgId: string,
    userId: string,
    branchId: string,
  ): Promise<void> {
    const membership = await this.deps.membershipAccess.findActiveByUser(
      orgId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenError("No active membership");
    }
    if (!canPerform(membership.role, "document.approve")) {
      throw new ForbiddenError("Role cannot approve documents");
    }
    assertBranchAccess(
      { role: membership.role, branchIds: membership.branchIds },
      branchId,
    );
  }

  private async dispatch(
    actionId: string,
    claims: {
      orgId: string;
      userId: string;
      entityRef: { type: string; id: string };
    },
    notification: Notification,
    input: { name?: string; password?: string },
  ): Promise<void> {
    const { type, id } = claims.entityRef;

    if (actionId === "approve" || actionId === "reject") {
      if (type === "purchase_order") {
        const po = await this.deps.purchaseOrders.get(claims.orgId, id);
        await this.assertDocumentApprove(
          claims.orgId,
          claims.userId,
          po.branchId,
        );
        if (actionId === "approve") {
          if (po.status === "approved") return;
          assertCanApprovePo(po);
          await this.deps.purchaseOrders.approve(claims.orgId, id);
          return;
        }
        if (po.status === "cancelled") return;
        await this.deps.purchaseOrders.cancel(claims.orgId, id);
        return;
      }
      if (type === "stock_adjustment") {
        const adj = await this.deps.stockAdjustments.get(claims.orgId, id);
        await this.assertDocumentApprove(
          claims.orgId,
          claims.userId,
          adj.branchId,
        );
        if (actionId === "approve") {
          if (adj.status === "approved") return;
          assertCanApproveAdjustment(adj);
          await this.deps.stockAdjustments.approve(claims.orgId, id);
          return;
        }
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
