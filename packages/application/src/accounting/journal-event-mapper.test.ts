import { describe, expect, it } from "vitest";
import { mapOutboxEventToJournalPlan } from "./journal-event-mapper.js";

describe("mapOutboxEventToJournalPlan", () => {
  it("maps GR posted to goods_receipt.posted with inventoryValueDelta", () => {
    const plan = mapOutboxEventToJournalPlan({
      id: "evt-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "37.5", receiptId: "gr-1" },
    });
    expect(plan).toMatchObject({
      kind: "create",
      journalEventType: "goods_receipt.posted",
      amount: "37.5",
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      isVoid: false,
    });
  });

  it("skips stock.changed", () => {
    expect(
      mapOutboxEventToJournalPlan({
        id: "e",
        orgId: "o",
        eventType: "stock.changed",
        aggregateType: "goods_receipt",
        aggregateId: "gr-1",
        payload: {},
      }),
    ).toEqual({ kind: "skip", reason: expect.any(String) });
  });

  it("maps void GR with reverse delta", () => {
    const plan = mapOutboxEventToJournalPlan({
      id: "evt-2",
      orgId: "org-1",
      eventType: "document.voided",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "37.5" },
    });
    expect(plan).toMatchObject({
      kind: "create",
      journalEventType: "goods_receipt.voided",
      isVoid: true,
    });
  });
});
