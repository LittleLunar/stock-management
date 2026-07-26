import type { PnlReport } from "@stock-management/domain";
import { buildPnl } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export class PnlReportUseCase {
  constructor(private readonly accounting: AccountingPort) {}

  async execute(
    orgId: string,
    input: { periodId: string; branchId?: string },
  ): Promise<PnlReport> {
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      periodId: input.periodId,
      branchId: input.branchId,
    });
    return buildPnl(rows);
  }
}
