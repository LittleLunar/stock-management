import { describe, expect, it } from "vitest";
import {
  assertJournalBalanced,
  assertPeriodOpen,
  monthBounds,
  periodsForFiscalYear,
  moneyAbs,
  voidEventType,
} from "./accounting.js";
import { PeriodClosedError, UnbalancedJournalError } from "./errors.js";

describe("assertJournalBalanced", () => {
  it("allows equal debit and credit", () => {
    expect(() =>
      assertJournalBalanced([
        { debit: "100", credit: "0" },
        { debit: "0", credit: "100" },
      ]),
    ).not.toThrow();
  });
  it("rejects unbalanced", () => {
    expect(() =>
      assertJournalBalanced([
        { debit: "100", credit: "0" },
        { debit: "0", credit: "90" },
      ]),
    ).toThrow(UnbalancedJournalError);
  });
});

describe("assertPeriodOpen", () => {
  it("rejects closed", () => {
    expect(() => assertPeriodOpen({ status: "closed" })).toThrow(
      PeriodClosedError,
    );
  });
});

describe("monthBounds", () => {
  it("returns Feb 2026 bounds", () => {
    expect(monthBounds(2026, 2)).toEqual({
      startsOn: "2026-02-01",
      endsOn: "2026-02-28",
    });
  });
});

describe("periodsForFiscalYear", () => {
  it("starts in April when fiscalYearStartMonth is 4", () => {
    const periods = periodsForFiscalYear(4, 2026);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ year: 2026, month: 4 });
    expect(periods[11]).toMatchObject({ year: 2027, month: 3 });
  });
});

describe("moneyAbs / voidEventType", () => {
  it("abs", () => {
    expect(moneyAbs("-12.5")).toBe("12.5");
  });
  it("void suffix", () => {
    expect(voidEventType("goods_receipt.posted")).toBe("goods_receipt.voided");
  });
});
