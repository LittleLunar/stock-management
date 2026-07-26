import { describe, expect, it } from "vitest";
import {
  assertFifoCostingMethod,
  assertLayersFullyOpen,
  resolveReceiptUnitCost,
  totalCost,
} from "./fifo-costing.js";
import {
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
