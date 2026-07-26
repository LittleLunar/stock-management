import { describe, expect, it } from "vitest";
import { TrialBalanceUseCase } from "./trial-balance.js";
import {
  ap,
  cogs,
  equity,
  inv,
  makeAccount,
  makeFakeAccountingWithLines,
} from "./report-test-fakes.js";

describe("TrialBalanceUseCase", () => {
  it("trial balance filters by periodId via port", async () => {
    const accounting = makeFakeAccountingWithLines([
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "10",
        credit: "0",
      },
      {
        orgId: "org-1",
        periodId: "p2",
        postedAt: new Date("2026-08-05T12:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "5",
        credit: "0",
      },
    ]);
    const uc = new TrialBalanceUseCase(accounting);
    const report = await uc.execute("org-1", { periodId: "p1" });
    expect(report.totalDebit).toBe("10.0000");
  });

  it("asOf includes mid-period postedAt on or before asOf", async () => {
    const accounting = makeFakeAccountingWithLines([
      {
        orgId: "org-1",
        periodId: "p-july",
        postedAt: new Date("2026-07-15T08:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "25",
        credit: "0",
      },
      {
        orgId: "org-1",
        periodId: "p-july",
        postedAt: new Date("2026-07-20T08:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "0",
        credit: "25",
      },
    ]);
    const uc = new TrialBalanceUseCase(accounting);
    const report = await uc.execute("org-1", { asOf: "2026-07-15" });
    expect(report.totalDebit).toBe("25.0000");
    expect(report.totalCredit).toBe("0.0000");
  });
});

describe("PnlReportUseCase", () => {
  it("P&L uses only the requested period", async () => {
    const accounting = makeFakeAccountingWithLines([
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: cogs,
        debit: "40",
        credit: "0",
      },
      {
        orgId: "org-1",
        periodId: "p2",
        postedAt: new Date("2026-08-01T12:00:00.000Z"),
        branchId: null,
        account: cogs,
        debit: "99",
        credit: "0",
      },
    ]);
    const { PnlReportUseCase } = await import("./pnl-report.js");
    const uc = new PnlReportUseCase(accounting);
    const report = await uc.execute("org-1", { periodId: "p1" });
    expect(report.totalExpense).toBe("40.0000");
    expect(report.netIncome).toBe("-40.0000");
  });
});

describe("BalanceSheetUseCase", () => {
  it("balance sheet folds netIncome and uses postedAt asOf", async () => {
    const accounting = makeFakeAccountingWithLines([
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "130",
        credit: "40",
      },
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: ap,
        debit: "0",
        credit: "50",
      },
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: makeAccount(
          "00000000-0000-4000-8000-000000000105",
          "2100",
          "GRNI",
          "liability",
        ),
        debit: "50",
        credit: "100",
      },
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: equity,
        debit: "0",
        credit: "30",
      },
      {
        orgId: "org-1",
        periodId: "p1",
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: cogs,
        debit: "40",
        credit: "0",
      },
    ]);
    const { BalanceSheetUseCase } = await import("./balance-sheet.js");
    const uc = new BalanceSheetUseCase(accounting);
    const report = await uc.execute("org-1", { asOf: "2026-07-31" });
    expect(report.netIncome).toBe("-40.0000");
    expect(report.totalEquity).toBe("-10.0000");
    expect(report.balanced).toBe(true);
  });
});
