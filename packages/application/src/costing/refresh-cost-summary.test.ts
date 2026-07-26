import { describe, expect, it } from "vitest";
import { createFakeCosting } from "./fake-costing.js";
import { costingOutboxFields } from "./outbox-cost-fields.js";
import { refreshCostSummary } from "./refresh-cost-summary.js";

describe("costingOutboxFields", () => {
  it("includes only defined fields", () => {
    expect(costingOutboxFields({ cogsTotal: "10" })).toEqual({
      cogsTotal: "10",
    });
    expect(
      costingOutboxFields({
        inventoryValueDelta: "5",
        landedAmount: "2",
        revaluationValueDelta: "-1",
      }),
    ).toEqual({
      inventoryValueDelta: "5",
      landedAmount: "2",
      revaluationValueDelta: "-1",
    });
  });
});

describe("recomputeProductCostSummary", () => {
  it("upserts qty and value from open layers", async () => {
    const costing = createFakeCosting();
    const key = {
      orgId: "org-1",
      productId: "p-1",
      locationId: "loc-1",
      lotId: null as string | null,
    };

    await costing.insertLayer({
      orgId: key.orgId,
      productId: key.productId,
      locationId: key.locationId,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      originalUnitCost: "10",
      qtyOriginal: "5",
      qtyRemaining: "5",
    });
    await costing.insertLayer({
      orgId: key.orgId,
      productId: key.productId,
      locationId: key.locationId,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-2",
      sourceDocumentLineId: "grl-2",
      sourceMovementId: "m-2",
      receivedAt: new Date("2026-01-02"),
      unitCost: "20",
      originalUnitCost: "20",
      qtyOriginal: "2",
      qtyRemaining: "2",
    });

    await refreshCostSummary(costing, key);
    expect(costing.summaries).toHaveLength(1);
    expect(costing.summaries[0]?.qtyRemainingSum).toBe("7");
    expect(costing.summaries[0]?.onHandValue).toBe("90");

    await costing.setQtyRemaining(key.orgId, costing.layers[0]!.id, "0");
    await refreshCostSummary(costing, key);
    expect(costing.summaries[0]?.qtyRemainingSum).toBe("2");
    expect(costing.summaries[0]?.onHandValue).toBe("40");
  });
});
