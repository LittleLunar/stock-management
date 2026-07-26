import type {
  Account,
  AccountMapping,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  PeriodStatus,
} from "@stock-management/domain";

export type JournalWithLines = JournalEntry & { lines: JournalLine[] };

export interface AccountingPort {
  listAccounts(orgId: string): Promise<Account[]>;
  findAccountByCode(orgId: string, code: string): Promise<Account | null>;
  insertAccount(
    account: Omit<Account, "id" | "createdAt"> & { id?: string },
  ): Promise<Account>;
  updateAccount(
    orgId: string,
    id: string,
    patch: Partial<Pick<Account, "name" | "active">>,
  ): Promise<Account>;

  listMappings(orgId: string): Promise<AccountMapping[]>;
  findMapping(
    orgId: string,
    journalEventType: string,
  ): Promise<AccountMapping | null>;
  upsertMapping(
    mapping: Omit<AccountMapping, "id"> & { id?: string },
  ): Promise<AccountMapping>;

  listPeriods(orgId: string): Promise<AccountingPeriod[]>;
  findPeriodByYearMonth(
    orgId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null>;
  findPeriodCoveringDate(
    orgId: string,
    onDate: string,
  ): Promise<AccountingPeriod | null>;
  insertPeriod(
    period: Omit<AccountingPeriod, "id"> & { id?: string },
  ): Promise<AccountingPeriod>;
  setPeriodStatus(
    orgId: string,
    id: string,
    status: PeriodStatus,
  ): Promise<AccountingPeriod>;

  findJournalByOutboxEventId(
    orgId: string,
    outboxEventId: string,
  ): Promise<JournalWithLines | null>;
  findJournalById(orgId: string, id: string): Promise<JournalWithLines | null>;
  listJournalsBySourceDocument(
    orgId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): Promise<JournalWithLines[]>;
  insertJournal(input: {
    entry: Omit<JournalEntry, "id" | "createdAt"> & { id?: string };
    lines: Array<Omit<JournalLine, "id" | "journalEntryId"> & { id?: string }>;
  }): Promise<JournalWithLines>;
}

