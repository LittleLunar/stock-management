import type {
  Account,
  AccountMapping,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  PeriodStatus,
} from "@stock-management/domain";
import type {
  AccountingPort,
  JournalWithLines,
} from "../ports/accounting.js";

function fakeUuid(seq: number): string {
  const hex = seq.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

export function makeFakeAccounting(): { port: AccountingPort } {
  const accounts = new Map<string, Account>();
  const mappings = new Map<string, AccountMapping>();
  const periods = new Map<string, AccountingPeriod>();
  const journals = new Map<string, JournalWithLines>();
  let accountSeq = 0;
  let mappingSeq = 0;
  let periodSeq = 0;
  let journalSeq = 0;
  let lineSeq = 0;

  const port: AccountingPort = {
    async listAccounts(orgId) {
      return [...accounts.values()].filter((a) => a.orgId === orgId);
    },
    async findAccountByCode(orgId, code) {
      return (
        [...accounts.values()].find(
          (a) => a.orgId === orgId && a.code === code,
        ) ?? null
      );
    },
    async insertAccount(account) {
      const row: Account = {
        id: account.id ?? fakeUuid(++accountSeq),
        orgId: account.orgId,
        code: account.code,
        name: account.name,
        type: account.type,
        active: account.active,
        createdAt: new Date(),
      };
      accounts.set(row.id, row);
      return row;
    },
    async updateAccount(orgId, id, patch) {
      const existing = accounts.get(id);
      if (!existing || existing.orgId !== orgId) {
        throw new Error("Account not found");
      }
      const updated = { ...existing, ...patch };
      accounts.set(id, updated);
      return updated;
    },
    async listMappings(orgId) {
      return [...mappings.values()].filter((m) => m.orgId === orgId);
    },
    async findMapping(orgId, journalEventType) {
      return (
        [...mappings.values()].find(
          (m) =>
            m.orgId === orgId && m.journalEventType === journalEventType,
        ) ?? null
      );
    },
    async upsertMapping(mapping) {
      const existing = await port.findMapping(
        mapping.orgId,
        mapping.journalEventType,
      );
      const row: AccountMapping = {
        id: mapping.id ?? existing?.id ?? fakeUuid(++mappingSeq),
        orgId: mapping.orgId,
        journalEventType: mapping.journalEventType,
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
      };
      mappings.set(row.id, row);
      return row;
    },
    async listPeriods(orgId) {
      return [...periods.values()].filter((p) => p.orgId === orgId);
    },
    async findPeriodByYearMonth(orgId, year, month) {
      return (
        [...periods.values()].find(
          (p) => p.orgId === orgId && p.year === year && p.month === month,
        ) ?? null
      );
    },
    async findPeriodCoveringDate(orgId, onDate) {
      return (
        [...periods.values()].find(
          (p) =>
            p.orgId === orgId && p.startsOn <= onDate && p.endsOn >= onDate,
        ) ?? null
      );
    },
    async insertPeriod(period) {
      const row: AccountingPeriod = {
        id: period.id ?? fakeUuid(++periodSeq),
        orgId: period.orgId,
        year: period.year,
        month: period.month,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        status: period.status,
      };
      periods.set(row.id, row);
      return row;
    },
    async setPeriodStatus(orgId, id, status: PeriodStatus) {
      const existing = periods.get(id);
      if (!existing || existing.orgId !== orgId) {
        throw new Error("Period not found");
      }
      const updated = { ...existing, status };
      periods.set(id, updated);
      return updated;
    },
    async findJournalByOutboxEventId(orgId, outboxEventId) {
      return (
        [...journals.values()].find(
          (j) => j.orgId === orgId && j.outboxEventId === outboxEventId,
        ) ?? null
      );
    },
    async findJournalById(orgId, id) {
      const j = journals.get(id);
      return j && j.orgId === orgId ? j : null;
    },
    async listJournalsBySourceDocument(
      orgId,
      sourceDocumentType,
      sourceDocumentId,
    ) {
      return [...journals.values()].filter(
        (j) =>
          j.orgId === orgId &&
          j.sourceDocumentType === sourceDocumentType &&
          j.sourceDocumentId === sourceDocumentId,
      );
    },
    async insertJournal(input) {
      const entryId = input.entry.id ?? fakeUuid(++journalSeq);
      const entry: JournalEntry = {
        id: entryId,
        orgId: input.entry.orgId,
        periodId: input.entry.periodId,
        branchId: input.entry.branchId,
        sourceDocumentType: input.entry.sourceDocumentType,
        sourceDocumentId: input.entry.sourceDocumentId,
        outboxEventId: input.entry.outboxEventId,
        reversesJournalId: input.entry.reversesJournalId,
        postedAt: input.entry.postedAt,
        createdAt: new Date(),
      };
      const lines: JournalLine[] = input.lines.map((line, i) => ({
        id: line.id ?? fakeUuid(++lineSeq),
        orgId: line.orgId,
        journalEntryId: entryId,
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        lineNo: line.lineNo ?? i + 1,
      }));
      const full: JournalWithLines = { ...entry, lines };
      journals.set(entryId, full);
      return full;
    },
    async sumLinesByAccount() {
      return [];
    },
  };

  return { port };
}
