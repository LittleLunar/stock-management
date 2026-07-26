import { describe, expect, it } from "vitest";
import { makeFakeAccounting } from "../accounting/fake-accounting.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";

describe("EnsureDefaultChartOfAccounts", () => {
  it("seeds seven accounts and default mappings idempotently", async () => {
    const { port } = makeFakeAccounting();
    const uc = new EnsureDefaultChartOfAccounts(port);
    const first = await uc.execute("org-1");
    expect(first.accounts).toHaveLength(7);
    expect(first.mappings).toHaveLength(18);
    const second = await uc.execute("org-1");
    expect(second.accounts).toHaveLength(7);
    expect(await port.findAccountByCode("org-1", "1300")).toMatchObject({
      name: "Inventory",
      type: "asset",
    });
    const grMap = await port.findMapping("org-1", "goods_receipt.posted");
    expect(grMap).not.toBeNull();
  });

  it("seeds supplier_invoice posted/voided mappings", async () => {
    const { port } = makeFakeAccounting();
    const uc = new EnsureDefaultChartOfAccounts(port);
    const result = await uc.execute("org-1");
    expect(result.mappings).toHaveLength(18);
    const posted = await port.findMapping("org-1", "supplier_invoice.posted");
    expect(posted).not.toBeNull();
    const ap = await port.findAccountByCode("org-1", "2000");
    const grni = await port.findAccountByCode("org-1", "2100");
    expect(posted!.debitAccountId).toBe(grni!.id);
    expect(posted!.creditAccountId).toBe(ap!.id);
  });
});
