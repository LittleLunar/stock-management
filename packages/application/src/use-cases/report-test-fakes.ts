import type { Account, AccountType } from "@stock-management/domain";
import { formatMoney } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";

export type FakeLine = {
  orgId: string;
  periodId: string;
  postedAt: Date;
  branchId: string | null;
  account: Pick<Account, "id" | "code" | "name" | "type">;
  debit: string;
  credit: string;
};

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function makeAccount(
  id: string,
  code: string,
  name: string,
  type: AccountType,
): Pick<Account, "id" | "code" | "name" | "type"> {
  return { id, code, name, type };
}

export function makeFakeAccountingWithLines(lines: FakeLine[]): AccountingPort {
  return {
    async listAccounts() {
      throw new Error("not used");
    },
    async findAccountByCode() {
      throw new Error("not used");
    },
    async insertAccount() {
      throw new Error("not used");
    },
    async updateAccount() {
      throw new Error("not used");
    },
    async listMappings() {
      throw new Error("not used");
    },
    async findMapping() {
      throw new Error("not used");
    },
    async upsertMapping() {
      throw new Error("not used");
    },
    async listPeriods() {
      throw new Error("not used");
    },
    async findPeriodByYearMonth() {
      throw new Error("not used");
    },
    async findPeriodCoveringDate() {
      throw new Error("not used");
    },
    async insertPeriod() {
      throw new Error("not used");
    },
    async setPeriodStatus() {
      throw new Error("not used");
    },
    async findJournalByOutboxEventId() {
      throw new Error("not used");
    },
    async findJournalById() {
      throw new Error("not used");
    },
    async listJournalsBySourceDocument() {
      throw new Error("not used");
    },
    async insertJournal() {
      throw new Error("not used");
    },

    async sumLinesByAccount(orgId, filter) {
      const matched = lines.filter((l) => {
        if (l.orgId !== orgId) return false;
        if (filter.branchId !== undefined && l.branchId !== filter.branchId) {
          return false;
        }
        if (filter.periodId !== undefined) {
          return l.periodId === filter.periodId;
        }
        if (filter.asOf !== undefined) {
          return utcDay(l.postedAt) <= filter.asOf;
        }
        return false;
      });
      const byAccount = new Map<
        string,
        {
          accountId: string;
          code: string;
          name: string;
          type: AccountType;
          debit: number;
          credit: number;
        }
      >();
      for (const l of matched) {
        const cur = byAccount.get(l.account.id) ?? {
          accountId: l.account.id,
          code: l.account.code,
          name: l.account.name,
          type: l.account.type,
          debit: 0,
          credit: 0,
        };
        cur.debit += Number(l.debit);
        cur.credit += Number(l.credit);
        byAccount.set(l.account.id, cur);
      }
      return [...byAccount.values()]
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          type: r.type,
          debitTotal: formatMoney(r.debit),
          creditTotal: formatMoney(r.credit),
        }));
    },
  };
}

export const inv = makeAccount(
  "00000000-0000-4000-8000-000000000101",
  "1300",
  "Inventory",
  "asset",
);
export const cogs = makeAccount(
  "00000000-0000-4000-8000-000000000102",
  "5000",
  "COGS",
  "expense",
);
export const ap = makeAccount(
  "00000000-0000-4000-8000-000000000103",
  "2000",
  "AP",
  "liability",
);
export const equity = makeAccount(
  "00000000-0000-4000-8000-000000000104",
  "3900",
  "Reval",
  "equity",
);
