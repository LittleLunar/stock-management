import { describe, expect, it } from "vitest";
import {
  buildBalanceSheet,
  buildPnl,
  buildTrialBalance,
} from "./financial-reports.js";

/** Balanced books: Inv 90 + GRNI 50 + AP 50 + Reval 30 + COGS 40 */
const rows = [
  {
    accountId: "a1",
    code: "1300",
    name: "Inventory",
    type: "asset" as const,
    debitTotal: "130.0000",
    creditTotal: "40.0000",
  },
  {
    accountId: "a2",
    code: "2100",
    name: "GRNI",
    type: "liability" as const,
    debitTotal: "50.0000",
    creditTotal: "100.0000",
  },
  {
    accountId: "a3",
    code: "2000",
    name: "AP",
    type: "liability" as const,
    debitTotal: "0.0000",
    creditTotal: "50.0000",
  },
  {
    accountId: "a4",
    code: "3900",
    name: "Reval",
    type: "equity" as const,
    debitTotal: "0.0000",
    creditTotal: "30.0000",
  },
  {
    accountId: "a5",
    code: "5000",
    name: "COGS",
    type: "expense" as const,
    debitTotal: "40.0000",
    creditTotal: "0.0000",
  },
];

describe("financial reports", () => {
  it("builds trial balance nets and totals", () => {
    const tb = buildTrialBalance(rows);
    expect(tb.totalDebit).toBe("220.0000");
    expect(tb.totalCredit).toBe("220.0000");
    expect(tb.rows.find((r) => r.code === "1300")!.net).toBe("90.0000");
  });

  it("builds P&L from income and expense only", () => {
    const pnl = buildPnl(rows);
    expect(pnl.income).toHaveLength(0);
    expect(pnl.totalExpense).toBe("40.0000");
    expect(pnl.netIncome).toBe("-40.0000");
  });

  it("folds netIncome into equity for interim balanced BS", () => {
    const bs = buildBalanceSheet(rows);
    expect(bs.totalAssets).toBe("90.0000");
    expect(bs.totalLiabilities).toBe("100.0000");
    expect(bs.netIncome).toBe("-40.0000");
    expect(bs.totalEquity).toBe("-10.0000");
    expect(bs.equity.find((r) => r.code === "3900")).toBeTruthy();
    expect(bs.balanced).toBe(true);
  });
});
