import { describe, expect, it } from "vitest";
import { makeAgingHarness } from "./supplier-invoice.harness.js";

describe("ApAgingReportUseCase", () => {
  it("ages entire posted balance into buckets", async () => {
    const { uc, seedPostedInvoice } = await makeAgingHarness();
    await seedPostedInvoice({
      invoiceDate: "2026-01-01",
      amount: "40",
    });
    await seedPostedInvoice({
      invoiceDate: "2026-06-20",
      amount: "10",
    });
    const report = await uc.execute("org-1", "2026-07-15");
    expect(report.grandTotal).toBe("50");
    expect(Number(report.totalsByBucket["90+"])).toBeGreaterThan(0);
  });
});
