import { describe, expect, it } from "vitest";
import {
  assertFifoCostingMethod,
  assertLayersFullyOpen,
  planFifoConsume,
  planPreferSourceLineThenFifo,
  resolveReceiptUnitCost,
  totalCost,
  weightedUnitCost,
} from "./fifo-costing.js";
import {
  InsufficientCostError,
  LayerInUseError,
  MissingUnitCostError,
  UnsupportedCostingMethodError,
} from "./errors.js";

describe("resolveReceiptUnitCost", () => {
  it("prefers line unit cost", () => {
    expect(resolveReceiptUnitCost("12.5", "9")).toBe("12.5");
  });
  it("falls back to PO line", () => {
    expect(resolveReceiptUnitCost(null, "9")).toBe("9");
  });
  it("throws when both missing", () => {
    expect(() => resolveReceiptUnitCost(null, null)).toThrow(MissingUnitCostError);
  });
});

describe("assertFifoCostingMethod", () => {
  it("allows fifo", () => {
    expect(() => assertFifoCostingMethod("fifo")).not.toThrow();
  });
  it("rejects avg", () => {
    expect(() => assertFifoCostingMethod("avg")).toThrow(UnsupportedCostingMethodError);
  });
});

describe("assertLayersFullyOpen", () => {
  it("rejects partially consumed layer", () => {
    expect(() =>
      assertLayersFullyOpen([{ qtyOriginal: "10", qtyRemaining: "4" }]),
    ).toThrow(LayerInUseError);
  });
});

describe("totalCost", () => {
  it("multiplies unit cost by abs qty", () => {
    expect(totalCost("10", "3")).toBe("30");
  });
});

describe("planFifoConsume", () => {
  it("consumes oldest layer first", () => {
    const plan = planFifoConsume(
      [
        { id: "a", qtyRemaining: "2", unitCost: "10", receivedAt: new Date("2026-01-01") },
        { id: "b", qtyRemaining: "5", unitCost: "12", receivedAt: new Date("2026-01-02") },
      ],
      "3",
    );
    expect(plan.slices).toEqual([
      expect.objectContaining({ layerId: "a", qty: "2", unitCost: "10", totalCost: "20" }),
      expect.objectContaining({ layerId: "b", qty: "1", unitCost: "12", totalCost: "12" }),
    ]);
    expect(plan.totalCost).toBe("32");
    expect(plan.unitCost).toBe(weightedUnitCost("32", "3"));
  });

  it("throws InsufficientCostError when layers short", () => {
    expect(() =>
      planFifoConsume(
        [{ id: "a", qtyRemaining: "1", unitCost: "10", receivedAt: new Date() }],
        "2",
      ),
    ).toThrow(InsufficientCostError);
  });
});

describe("planPreferSourceLineThenFifo", () => {
  it("prefers source-line layers then FIFO", () => {
    const plan = planPreferSourceLineThenFifo(
      [{ id: "pref", qtyRemaining: "1", unitCost: "8", receivedAt: new Date("2026-01-03") }],
      [
        { id: "old", qtyRemaining: "9", unitCost: "10", receivedAt: new Date("2026-01-01") },
        { id: "pref", qtyRemaining: "1", unitCost: "8", receivedAt: new Date("2026-01-03") },
      ],
      "2",
    );
    expect(plan.slices[0]?.layerId).toBe("pref");
    expect(plan.slices[1]?.layerId).toBe("old");
  });
});
