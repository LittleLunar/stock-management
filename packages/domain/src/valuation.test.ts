import { describe, expect, it } from "vitest";
import {
  allocateLandedUnitCost,
  assertAllocationSumsToTotal,
  layerValueAtAsOf,
  netConsumedQty,
  revaluationValueDelta,
  unitCostAtAsOf,
} from "./valuation.js";
import { AllocationMismatchError } from "./errors.js";
import { InvalidStateError } from "./errors.js";

describe("allocateLandedUnitCost", () => {
  it("spreads allocated amount across remaining qty", () => {
    const result = allocateLandedUnitCost("10", "10", "50");
    expect(result.newUnitCost).toBe("15");
    expect(result.valueDelta).toBe("50");
  });

  it("throws when qty remaining is zero", () => {
    expect(() => allocateLandedUnitCost("0", "10", "50")).toThrow(InvalidStateError);
  });

  it("throws when qty remaining is negative", () => {
    expect(() => allocateLandedUnitCost("-1", "10", "50")).toThrow(InvalidStateError);
  });
});

describe("revaluationValueDelta", () => {
  it("returns qty times unit cost change", () => {
    expect(revaluationValueDelta("10", "10", "12")).toBe("20");
  });

  it("returns negative delta when cost decreases", () => {
    expect(revaluationValueDelta("5", "20", "18")).toBe("-10");
  });
});

describe("netConsumedQty", () => {
  const asOf = new Date("2026-06-15T12:00:00Z");

  it("sums consumptions and subtracts reversals up to asOf", () => {
    const consumptions = [
      { qty: "3", isReversal: false, createdAt: new Date("2026-06-01") },
      { qty: "2", isReversal: false, createdAt: new Date("2026-06-10") },
      { qty: "1", isReversal: true, createdAt: new Date("2026-06-12") },
    ];
    expect(netConsumedQty(consumptions, asOf)).toBe("4");
  });

  it("ignores consumptions after asOf", () => {
    const consumptions = [
      { qty: "3", isReversal: false, createdAt: new Date("2026-06-01") },
      { qty: "5", isReversal: false, createdAt: new Date("2026-06-20") },
    ];
    expect(netConsumedQty(consumptions, asOf)).toBe("3");
  });

  it("returns zero when no consumptions", () => {
    expect(netConsumedQty([], asOf)).toBe("0");
  });
});

describe("unitCostAtAsOf", () => {
  const asOf = new Date("2026-06-15T12:00:00Z");

  it("returns original when no adjustments apply", () => {
    expect(
      unitCostAtAsOf("10", [{ effectiveAt: new Date("2026-07-01"), newUnitCost: "15" }], asOf),
    ).toBe("10");
  });

  it("returns last adjustment effective on or before asOf", () => {
    const adjustments = [
      { effectiveAt: new Date("2026-06-01"), newUnitCost: "12" },
      { effectiveAt: new Date("2026-06-10"), newUnitCost: "14" },
      { effectiveAt: new Date("2026-06-20"), newUnitCost: "16" },
    ];
    expect(unitCostAtAsOf("10", adjustments, asOf)).toBe("14");
  });
});

describe("layerValueAtAsOf", () => {
  const receivedAt = new Date("2026-06-01");
  const asOf = new Date("2026-06-15T12:00:00Z");

  it("returns null when layer received after asOf", () => {
    expect(
      layerValueAtAsOf({
        receivedAt: new Date("2026-07-01"),
        qtyOriginal: "10",
        originalUnitCost: "10",
        consumptions: [],
        adjustments: [],
        asOf,
      }),
    ).toBeNull();
  });

  it("returns null when fully consumed as of date", () => {
    expect(
      layerValueAtAsOf({
        receivedAt,
        qtyOriginal: "10",
        originalUnitCost: "10",
        consumptions: [
          { qty: "10", isReversal: false, createdAt: new Date("2026-06-05") },
        ],
        adjustments: [],
        asOf,
      }),
    ).toBeNull();
  });

  it("values partial qty with revalued unit cost as of date", () => {
    const result = layerValueAtAsOf({
      receivedAt,
      qtyOriginal: "10",
      originalUnitCost: "10",
      consumptions: [
        { qty: "4", isReversal: false, createdAt: new Date("2026-06-05") },
      ],
      adjustments: [{ effectiveAt: new Date("2026-06-10"), newUnitCost: "12" }],
      asOf,
    });
    expect(result).toEqual({
      qty: "6",
      unitCost: "12",
      value: "72",
    });
  });

  it("uses original unit cost when revaluation is after asOf", () => {
    const result = layerValueAtAsOf({
      receivedAt,
      qtyOriginal: "10",
      originalUnitCost: "10",
      consumptions: [
        { qty: "2", isReversal: false, createdAt: new Date("2026-06-05") },
      ],
      adjustments: [{ effectiveAt: new Date("2026-06-20"), newUnitCost: "15" }],
      asOf,
    });
    expect(result).toEqual({
      qty: "8",
      unitCost: "10",
      value: "80",
    });
  });
});

describe("assertAllocationSumsToTotal", () => {
  it("passes when line amounts sum to total", () => {
    expect(() => assertAllocationSumsToTotal(["10", "20.5", "9.5"], "40")).not.toThrow();
  });

  it("throws AllocationMismatchError when sums differ", () => {
    expect(() => assertAllocationSumsToTotal(["10", "20"], "35")).toThrow(
      AllocationMismatchError,
    );
  });
});
