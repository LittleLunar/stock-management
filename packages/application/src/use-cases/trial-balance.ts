import type { TrialBalanceReport } from "@stock-management/domain";
import { buildTrialBalance } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export type TrialBalanceQuery =
  | { periodId: string; asOf?: never; branchId?: string }
  | { asOf: string; periodId?: never; branchId?: string };

export class TrialBalanceUseCase {
  constructor(private readonly accounting: AccountingPort) {}

  async execute(
    orgId: string,
    query: TrialBalanceQuery,
  ): Promise<TrialBalanceReport> {
    if ("periodId" in query && query.periodId) {
      const rows = await this.accounting.sumLinesByAccount(orgId, {
        periodId: query.periodId,
        branchId: query.branchId,
      });
      return buildTrialBalance(rows);
    }
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      asOf: query.asOf!,
      branchId: query.branchId,
    });
    return buildTrialBalance(rows);
  }
}
