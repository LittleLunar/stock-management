import { describe, expect, it } from "vitest";
import { subscriptionMatchesEvent } from "./webhooks.js";

const baseSub = {
  orgId: "org-1",
  active: true,
  eventTypes: ["document.posted", "document.voided"],
  branchId: null as string | null,
};

describe("subscriptionMatchesEvent", () => {
  it("matches active org + event type with no branch filter", () => {
    expect(
      subscriptionMatchesEvent(baseSub, {
        orgId: "org-1",
        eventType: "document.posted",
        payload: { branchId: "b1" },
      }),
    ).toBe(true);
  });

  it("rejects inactive", () => {
    expect(
      subscriptionMatchesEvent(
        { ...baseSub, active: false },
        { orgId: "org-1", eventType: "document.posted", payload: {} },
      ),
    ).toBe(false);
  });

  it("rejects wrong org", () => {
    expect(
      subscriptionMatchesEvent(baseSub, {
        orgId: "org-2",
        eventType: "document.posted",
        payload: {},
      }),
    ).toBe(false);
  });

  it("rejects event type not in list", () => {
    expect(
      subscriptionMatchesEvent(baseSub, {
        orgId: "org-1",
        eventType: "stock.changed",
        payload: {},
      }),
    ).toBe(false);
  });

  it("requires payload.branchId when subscription filters by branch", () => {
    const sub = { ...baseSub, branchId: "b1" };
    expect(
      subscriptionMatchesEvent(sub, {
        orgId: "org-1",
        eventType: "document.posted",
        payload: {},
      }),
    ).toBe(false);
    expect(
      subscriptionMatchesEvent(sub, {
        orgId: "org-1",
        eventType: "document.posted",
        payload: { branchId: "b2" },
      }),
    ).toBe(false);
    expect(
      subscriptionMatchesEvent(sub, {
        orgId: "org-1",
        eventType: "document.posted",
        payload: { branchId: "b1" },
      }),
    ).toBe(true);
  });
});
