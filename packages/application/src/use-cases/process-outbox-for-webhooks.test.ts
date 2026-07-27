import { describe, expect, it, vi } from "vitest";
import type {
  WebhookDelivery,
  WebhookSubscription,
} from "@stock-management/domain";
import { WebhookDeliveryError } from "@stock-management/domain";
import type { HttpPoster, WebhookPort } from "../ports/webhook.js";
import { ProcessOutboxForWebhooks } from "./process-outbox-for-webhooks.js";
import { webhookSignatureHeader } from "../webhooks/hmac.js";

function memPort(subs: WebhookSubscription[]): WebhookPort & {
  deliveries: WebhookDelivery[];
} {
  const deliveries: WebhookDelivery[] = [];
  return {
    deliveries,
    async listSubscriptions(orgId) {
      return subs.filter((s) => s.orgId === orgId);
    },
    async findSubscription(orgId, id) {
      return subs.find((s) => s.orgId === orgId && s.id === id) ?? null;
    },
    async listActiveSubscriptions(orgId) {
      return subs.filter((s) => s.orgId === orgId && s.active);
    },
    async createSubscription() {
      throw new Error("not used");
    },
    async updateSubscription() {
      return null;
    },
    async findDeliveryBySubscriptionAndEvent(orgId, subscriptionId, outboxEventId) {
      return (
        deliveries.find(
          (d) =>
            d.orgId === orgId &&
            d.subscriptionId === subscriptionId &&
            d.outboxEventId === outboxEventId,
        ) ?? null
      );
    },
    async insertDelivery(input) {
      const row: WebhookDelivery = {
        id: `del-${deliveries.length + 1}`,
        orgId: input.orgId,
        subscriptionId: input.subscriptionId,
        outboxEventId: input.outboxEventId,
        status: input.status,
        httpStatus: input.httpStatus,
        error: input.error,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      deliveries.push(row);
      return row;
    },
    async updateDelivery(orgId, id, patch) {
      const row = deliveries.find((d) => d.orgId === orgId && d.id === id)!;
      Object.assign(row, patch, { updatedAt: new Date() });
      return row;
    },
    async listDeliveries(orgId) {
      return deliveries.filter((d) => d.orgId === orgId);
    },
  };
}

const sub: WebhookSubscription = {
  id: "sub-1",
  orgId: "org-1",
  url: "https://example.test/hook",
  secret: "hook-secret",
  eventTypes: ["document.posted"],
  branchId: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const event = {
  id: "evt-1",
  orgId: "org-1",
  eventType: "document.posted",
  aggregateType: "goods_receipt",
  aggregateId: "gr-1",
  payload: { branchId: "b1", documentType: "goods_receipt" },
  createdAt: new Date("2026-07-26T10:00:00.000Z"),
};

describe("ProcessOutboxForWebhooks", () => {
  it("POSTs signed JSON and records succeeded delivery", async () => {
    const port = memPort([sub]);
    const post = vi.fn<HttpPoster>(async (_url, init) => {
      expect(init.headers["content-type"]).toBe("application/json");
      expect(init.headers["X-Webhook-Signature"]).toBe(
        webhookSignatureHeader(init.body, sub.secret),
      );
      const parsed = JSON.parse(init.body);
      expect(parsed.id).toBe("evt-1");
      expect(parsed.eventType).toBe("document.posted");
      return { status: 200, bodyText: "ok" };
    });
    const uc = new ProcessOutboxForWebhooks(port, post);
    await uc.execute(event);
    expect(post).toHaveBeenCalledTimes(1);
    expect(port.deliveries[0]!.status).toBe("succeeded");
    expect(port.deliveries[0]!.httpStatus).toBe(200);
  });

  it("skips re-POST when prior delivery succeeded (idempotent)", async () => {
    const port = memPort([sub]);
    port.deliveries.push({
      id: "del-existing",
      orgId: "org-1",
      subscriptionId: "sub-1",
      outboxEventId: "evt-1",
      status: "succeeded",
      httpStatus: 200,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const post = vi.fn(async () => ({ status: 200, bodyText: "ok" }));
    await new ProcessOutboxForWebhooks(port, post).execute(event);
    expect(post).not.toHaveBeenCalled();
  });

  it("throws WebhookDeliveryError on non-2xx and marks failed", async () => {
    const port = memPort([sub]);
    const post = vi.fn(async () => ({ status: 500, bodyText: "nope" }));
    await expect(
      new ProcessOutboxForWebhooks(port, post).execute(event),
    ).rejects.toBeInstanceOf(WebhookDeliveryError);
    expect(port.deliveries[0]!.status).toBe("failed");
    expect(port.deliveries[0]!.httpStatus).toBe(500);
  });

  it("does not call fetch when no subscriptions match", async () => {
    const port = memPort([
      { ...sub, eventTypes: ["document.voided"] },
    ]);
    const post = vi.fn(async () => ({ status: 200, bodyText: "ok" }));
    await new ProcessOutboxForWebhooks(port, post).execute(event);
    expect(post).not.toHaveBeenCalled();
    expect(port.deliveries).toHaveLength(0);
  });

  it("filters by subscription branchId", async () => {
    const port = memPort([{ ...sub, branchId: "b2" }]);
    const post = vi.fn(async () => ({ status: 200, bodyText: "ok" }));
    await new ProcessOutboxForWebhooks(port, post).execute(event);
    expect(post).not.toHaveBeenCalled();
  });
});
