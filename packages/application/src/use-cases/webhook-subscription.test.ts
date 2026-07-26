import { describe, expect, it } from "vitest";
import { NotFoundError } from "@stock-management/domain";
import type { WebhookPort } from "../ports/webhook.js";
import { WebhookSubscriptionUseCases } from "./webhook-subscription.js";

describe("WebhookSubscriptionUseCases", () => {
  it("create + get round trip via port", async () => {
    const created: Parameters<WebhookPort["createSubscription"]> extends [
      string,
      infer I,
    ]
      ? I
      : never = {
      url: "https://hooks.example/x",
      secret: "12345678",
      eventTypes: ["document.posted"],
      branchId: null,
      active: true,
    };
    const store = new Map();
    const port: WebhookPort = {
      async listSubscriptions(orgId) {
        return [...store.values()].filter((s) => s.orgId === orgId);
      },
      async findSubscription(orgId, id) {
        const s = store.get(id);
        return s?.orgId === orgId ? s : null;
      },
      async listActiveSubscriptions(orgId) {
        return [...store.values()].filter((s) => s.orgId === orgId && s.active);
      },
      async createSubscription(orgId, input) {
        const row = {
          id: "sub-1",
          orgId,
          url: input.url,
          secret: input.secret,
          eventTypes: input.eventTypes,
          branchId: input.branchId ?? null,
          active: input.active ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(row.id, row);
        return row;
      },
      async updateSubscription(orgId, id, input) {
        const row = store.get(id);
        if (!row || row.orgId !== orgId) return null;
        Object.assign(row, input, { updatedAt: new Date() });
        return row;
      },
      async findDeliveryBySubscriptionAndEvent() {
        return null;
      },
      async insertDelivery() {
        throw new Error("n/a");
      },
      async updateDelivery() {
        throw new Error("n/a");
      },
      async listDeliveries() {
        return [];
      },
    };
    const uc = new WebhookSubscriptionUseCases(port);
    const row = await uc.create("org-1", created);
    expect(row.url).toBe("https://hooks.example/x");
    expect(await uc.get("org-1", row.id)).toEqual(row);
    await expect(uc.get("org-1", "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
