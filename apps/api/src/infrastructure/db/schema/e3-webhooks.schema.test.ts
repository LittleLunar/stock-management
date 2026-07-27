import { describe, expect, it } from "vitest";
import {
  webhookDeliveries,
  webhookDeliveryStatusEnum,
  webhookSubscriptions,
} from "./index.js";

describe("E3 webhooks schema", () => {
  it("exposes webhook_delivery_status enum", () => {
    expect(webhookDeliveryStatusEnum.enumValues).toEqual([
      "pending",
      "succeeded",
      "failed",
    ]);
  });

  it("defines webhook_subscriptions with org scope, event_types array, optional branch", () => {
    expect(webhookSubscriptions.orgId).toBeDefined();
    expect(webhookSubscriptions.url).toBeDefined();
    expect(webhookSubscriptions.secret).toBeDefined();
    expect(webhookSubscriptions.eventTypes).toBeDefined();
    expect(webhookSubscriptions.branchId).toBeDefined();
    expect(webhookSubscriptions.active).toBeDefined();
  });

  it("defines webhook_deliveries linked to subscription and outbox event", () => {
    expect(webhookDeliveries.orgId).toBeDefined();
    expect(webhookDeliveries.subscriptionId).toBeDefined();
    expect(webhookDeliveries.outboxEventId).toBeDefined();
    expect(webhookDeliveries.status).toBeDefined();
    expect(webhookDeliveries.httpStatus).toBeDefined();
    expect(webhookDeliveries.error).toBeDefined();
  });
});
