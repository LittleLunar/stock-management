import type { WebhookSubscription } from "./entities.js";

export type OutboxEventLike = {
  orgId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export function subscriptionMatchesEvent(
  sub: Pick<WebhookSubscription, "orgId" | "active" | "eventTypes" | "branchId">,
  event: OutboxEventLike,
): boolean {
  if (!sub.active) return false;
  if (sub.orgId !== event.orgId) return false;
  if (!sub.eventTypes.includes(event.eventType)) return false;
  if (sub.branchId != null) {
    const branchId = event.payload.branchId;
    if (typeof branchId !== "string" || branchId !== sub.branchId) return false;
  }
  return true;
}
