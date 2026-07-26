import { describe, expect, it } from "vitest";
import {
  assertExactUnitCost,
  assertLineAmount,
  assertRemainingCapacity,
  agingBucket,
  buildApAgingReport,
  daysBetween,
  planInvoiceLineMatch,
  ThreeWayMatchError,
} from "./ap-match.js";

describe("assertRemainingCapacity", () => {
  it("allows when request fits remaining", () => {
    expect(() =>
      assertRemainingCapacity("10", "100", "4", "40", "6", "60", "PO line"),
    ).not.toThrow();
  });

  it("rejects over-qty", () => {
    expect(() =>
      assertRemainingCapacity("10", "100", "4", "40", "7", "70", "PO line"),
    ).toThrow(ThreeWayMatchError);
  });
});

describe("assertExactUnitCost", () => {
  it("rejects cost mismatch", () => {
    expect(() => assertExactUnitCost("11", "10", "10")).toThrow(
      ThreeWayMatchError,
    );
  });

  it("rejects null reference cost", () => {
    expect(() => assertExactUnitCost("10", null, "10")).toThrow(
      ThreeWayMatchError,
    );
  });
});

describe("assertLineAmount", () => {
  it("rejects amount not equal qty * unitCost", () => {
    expect(() => assertLineAmount("2", "10", "21")).toThrow(ThreeWayMatchError);
  });
});

describe("planInvoiceLineMatch", () => {
  const base = {
    poLine: {
      id: "pol-1",
      orderedQty: "10",
      unitCost: "5",
      productId: "p1",
      purchaseOrderId: "po-1",
    },
    grLine: {
      id: "grl-1",
      qty: "8",
      unitCost: "5",
      productId: "p1",
      purchaseOrderLineId: "pol-1",
      goodsReceiptId: "gr-1",
    },
    gr: { id: "gr-1", status: "posted" as const, supplierId: "sup-1" },
    matchedOnPo: { qty: "0", amount: "0" },
    matchedOnGr: { qty: "0", amount: "0" },
  };

  it("plans exact match", () => {
    const plan = planInvoiceLineMatch(
      {
        lineNumber: 1,
        qty: "3",
        unitCost: "5",
        amount: "15",
        purchaseOrderLineId: "pol-1",
        goodsReceiptLineId: "grl-1",
      },
      base,
    );
    expect(plan).toEqual({
      purchaseOrderLineId: "pol-1",
      goodsReceiptLineId: "grl-1",
      matchedQty: "3",
      matchedAmount: "15",
      lineNumber: 1,
    });
  });
});

describe("aging", () => {
  it("daysBetween and buckets", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-01", "2026-02-01")).toBe(31);
    expect(agingBucket(0)).toBe("0-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(91)).toBe("90+");
  });

  it("buildApAgingReport totals posted only", () => {
    const report = buildApAgingReport(
      [
        {
          id: "i1",
          supplierId: "s1",
          invoiceNumber: "INV-1",
          invoiceDate: "2026-01-01",
          status: "posted",
          openBalance: "100",
        },
        {
          id: "i2",
          supplierId: "s1",
          invoiceNumber: "INV-2",
          invoiceDate: "2026-01-01",
          status: "voided",
          openBalance: "50",
        },
      ],
      "2026-01-10",
    );
    expect(report.grandTotal).toBe("100");
    expect(report.invoices).toHaveLength(1);
    expect(report.totalsByBucket["0-30"]).toBe("100");
  });
});
