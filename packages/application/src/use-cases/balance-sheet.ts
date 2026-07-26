import type { BalanceSheetReport } from "@stock-management/domain";
import { buildBalanceSheet } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export class BalanceSheetUseCase {
  constructor(private readonly accounting: AccountingPort) {}

  async execute(
    orgId: string,
    input: { asOf: string; branchId?: string },
  ): Promise<BalanceSheetReport> {
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      asOf: input.asOf,
      branchId: input.branchId,
    });
    return buildBalanceSheet(rows);
  }
}
