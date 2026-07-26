import { describe, expect, it } from "vitest";
import { InvoiceNotDraftError } from "@stock-management/domain";
import { makeSupplierInvoiceHarness } from "./supplier-invoice.harness.js";

describe("SupplierInvoiceUseCases", () => {
  it("creates draft invoice with required PO+GR line links", async () => {
    const { uc } = await makeSupplierInvoiceHarness();
    const inv = await uc.create("org-1", {
      supplierId: "sup-1",
      invoiceNumber: "INV-1",
      invoiceDate: "2026-07-01",
      lines: [
        {
          lineNumber: 1,
          qty: "2",
          unitCost: "10",
          amount: "20",
          purchaseOrderLineId: "pol-1",
          goodsReceiptLineId: "grl-1",
        },
      ],
    });
    expect(inv.status).toBe("draft");
    expect(inv.lines[0]!.purchaseOrderLineId).toBe("pol-1");
  });

  it("rejects update when not draft", async () => {
    const { uc, seedPosted } = await makeSupplierInvoiceHarness();
    const id = await seedPosted();
    await expect(
      uc.update("org-1", id, { invoiceNumber: "X" }),
    ).rejects.toBeInstanceOf(InvoiceNotDraftError);
  });
});
