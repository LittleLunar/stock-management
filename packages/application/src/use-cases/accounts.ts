import type {
  Account,
  AccountMapping,
  AccountType,
} from "@stock-management/domain";
import { NotFoundError } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export class AccountUseCases {
  constructor(private readonly accounting: AccountingPort) {}

  list(orgId: string): Promise<Account[]> {
    return this.accounting.listAccounts(orgId);
  }

  create(
    orgId: string,
    input: { code: string; name: string; type: AccountType },
  ): Promise<Account> {
    return this.accounting.insertAccount({
      orgId,
      code: input.code,
      name: input.name,
      type: input.type,
      active: true,
    });
  }

  async patch(
    orgId: string,
    id: string,
    patch: { name?: string; active?: boolean },
  ): Promise<Account> {
    const accounts = await this.accounting.listAccounts(orgId);
    if (!accounts.some((a) => a.id === id)) {
      throw new NotFoundError("Account");
    }
    return this.accounting.updateAccount(orgId, id, patch);
  }

  listMappings(orgId: string): Promise<AccountMapping[]> {
    return this.accounting.listMappings(orgId);
  }

  upsertMapping(
    orgId: string,
    input: {
      journalEventType: string;
      debitAccountId: string;
      creditAccountId: string;
    },
  ): Promise<AccountMapping> {
    return this.accounting.upsertMapping({
      orgId,
      journalEventType: input.journalEventType as AccountMapping["journalEventType"],
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
    });
  }
}
