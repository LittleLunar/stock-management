import type { AccountingPeriod } from "@stock-management/domain";
import { NotFoundError, periodsForFiscalYear } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export class AccountingPeriodUseCases {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly getFiscalYearStartMonth: (
      orgId: string,
    ) => Promise<number>,
  ) {}

  list(orgId: string): Promise<AccountingPeriod[]> {
    return this.accounting.listPeriods(orgId);
  }

  async generate(
    orgId: string,
    fiscalYear: number,
  ): Promise<{ created: AccountingPeriod[]; existing: AccountingPeriod[] }> {
    const startMonth = await this.getFiscalYearStartMonth(orgId);
    const specs = periodsForFiscalYear(startMonth, fiscalYear);
    const created: AccountingPeriod[] = [];
    const existing: AccountingPeriod[] = [];
    for (const spec of specs) {
      const found = await this.accounting.findPeriodByYearMonth(
        orgId,
        spec.year,
        spec.month,
      );
      if (found) {
        existing.push(found);
        continue;
      }
      created.push(
        await this.accounting.insertPeriod({
          orgId,
          year: spec.year,
          month: spec.month,
          startsOn: spec.startsOn,
          endsOn: spec.endsOn,
          status: "open",
        }),
      );
    }
    return { created, existing };
  }

  async open(orgId: string, periodId: string): Promise<AccountingPeriod> {
    const periods = await this.accounting.listPeriods(orgId);
    if (!periods.some((p) => p.id === periodId)) {
      throw new NotFoundError("Accounting period");
    }
    return this.accounting.setPeriodStatus(orgId, periodId, "open");
  }

  async close(orgId: string, periodId: string): Promise<AccountingPeriod> {
    const periods = await this.accounting.listPeriods(orgId);
    if (!periods.some((p) => p.id === periodId)) {
      throw new NotFoundError("Accounting period");
    }
    return this.accounting.setPeriodStatus(orgId, periodId, "closed");
  }
}
