import type { Account, AccountMapping } from "@stock-management/domain";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_MAPPING_SPECS,
} from "../accounting/default-chart.js";
import type { AccountingPort } from "../ports/accounting.js";

export class EnsureDefaultChartOfAccounts {
  constructor(private readonly accounting: AccountingPort) {}

  async execute(
    orgId: string,
  ): Promise<{ accounts: Account[]; mappings: AccountMapping[] }> {
    const accounts: Account[] = [];
    for (const def of DEFAULT_ACCOUNTS) {
      const existing = await this.accounting.findAccountByCode(orgId, def.code);
      if (existing) {
        accounts.push(existing);
        continue;
      }
      accounts.push(
        await this.accounting.insertAccount({
          orgId,
          code: def.code,
          name: def.name,
          type: def.type,
          active: true,
        }),
      );
    }

    const byCode = new Map(accounts.map((a) => [a.code, a.id]));
    const mappings: AccountMapping[] = [];
    for (const spec of DEFAULT_MAPPING_SPECS) {
      const debitAccountId = byCode.get(spec.debitCode);
      const creditAccountId = byCode.get(spec.creditCode);
      if (!debitAccountId || !creditAccountId) {
        throw new Error(
          `Default account missing for mapping ${spec.journalEventType}`,
        );
      }
      mappings.push(
        await this.accounting.upsertMapping({
          orgId,
          journalEventType: spec.journalEventType,
          debitAccountId,
          creditAccountId,
        }),
      );
    }

    return { accounts, mappings };
  }
}
