import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type {
  AccountingPort,
  JournalWithLines,
} from "@stock-management/application";
import type {
  Account,
  AccountMapping,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  JournalEventType,
  PeriodStatus,
} from "@stock-management/domain";
import { NotFoundError } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  accountMappings,
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
} from "../db/schema/index.js";

function mapAccount(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    orgId: row.orgId,
    code: row.code,
    name: row.name,
    type: row.type,
    active: row.active,
    createdAt: row.createdAt,
  };
}

function mapMapping(row: typeof accountMappings.$inferSelect): AccountMapping {
  return {
    id: row.id,
    orgId: row.orgId,
    journalEventType: row.journalEventType as JournalEventType,
    debitAccountId: row.debitAccountId,
    creditAccountId: row.creditAccountId,
  };
}

function mapPeriod(row: typeof accountingPeriods.$inferSelect): AccountingPeriod {
  return {
    id: row.id,
    orgId: row.orgId,
    year: row.year,
    month: row.month,
    startsOn: String(row.startsOn),
    endsOn: String(row.endsOn),
    status: row.status,
  };
}

function mapEntry(row: typeof journalEntries.$inferSelect): JournalEntry {
  return {
    id: row.id,
    orgId: row.orgId,
    periodId: row.periodId,
    branchId: row.branchId,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    outboxEventId: row.outboxEventId,
    reversesJournalId: row.reversesJournalId,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
  };
}

function mapLine(row: typeof journalLines.$inferSelect): JournalLine {
  return {
    id: row.id,
    orgId: row.orgId,
    journalEntryId: row.journalEntryId,
    accountId: row.accountId,
    debit: String(row.debit),
    credit: String(row.credit),
    lineNo: row.lineNo,
  };
}

export class DrizzleAccountingRepository implements AccountingPort {
  constructor(private readonly db: DbClient) {}

  async listAccounts(orgId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(asc(accounts.code));
    return rows.map(mapAccount);
  }

  async findAccountByCode(orgId: string, code: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, code)))
      .limit(1);
    return row ? mapAccount(row) : null;
  }

  async insertAccount(
    account: Omit<Account, "id" | "createdAt"> & { id?: string },
  ): Promise<Account> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        id: account.id,
        orgId: account.orgId,
        code: account.code,
        name: account.name,
        type: account.type,
        active: account.active,
      })
      .returning();
    return mapAccount(row!);
  }

  async updateAccount(
    orgId: string,
    id: string,
    patch: Partial<Pick<Account, "name" | "active">>,
  ): Promise<Account> {
    const [row] = await this.db
      .update(accounts)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      })
      .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)))
      .returning();
    if (!row) throw new NotFoundError("Account");
    return mapAccount(row);
  }

  async listMappings(orgId: string): Promise<AccountMapping[]> {
    const rows = await this.db
      .select()
      .from(accountMappings)
      .where(eq(accountMappings.orgId, orgId));
    return rows.map(mapMapping);
  }

  async findMapping(
    orgId: string,
    journalEventType: string,
  ): Promise<AccountMapping | null> {
    const [row] = await this.db
      .select()
      .from(accountMappings)
      .where(
        and(
          eq(accountMappings.orgId, orgId),
          eq(accountMappings.journalEventType, journalEventType),
        ),
      )
      .limit(1);
    return row ? mapMapping(row) : null;
  }

  async upsertMapping(
    mapping: Omit<AccountMapping, "id"> & { id?: string },
  ): Promise<AccountMapping> {
    const existing = await this.findMapping(
      mapping.orgId,
      mapping.journalEventType,
    );
    if (existing) {
      const [row] = await this.db
        .update(accountMappings)
        .set({
          debitAccountId: mapping.debitAccountId,
          creditAccountId: mapping.creditAccountId,
        })
        .where(
          and(
            eq(accountMappings.orgId, mapping.orgId),
            eq(accountMappings.id, existing.id),
          ),
        )
        .returning();
      return mapMapping(row!);
    }
    const [row] = await this.db
      .insert(accountMappings)
      .values({
        id: mapping.id,
        orgId: mapping.orgId,
        journalEventType: mapping.journalEventType,
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
      })
      .returning();
    return mapMapping(row!);
  }

  async listPeriods(orgId: string): Promise<AccountingPeriod[]> {
    const rows = await this.db
      .select()
      .from(accountingPeriods)
      .where(eq(accountingPeriods.orgId, orgId))
      .orderBy(asc(accountingPeriods.year), asc(accountingPeriods.month));
    return rows.map(mapPeriod);
  }

  async findPeriodByYearMonth(
    orgId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null> {
    const [row] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.orgId, orgId),
          eq(accountingPeriods.year, year),
          eq(accountingPeriods.month, month),
        ),
      )
      .limit(1);
    return row ? mapPeriod(row) : null;
  }

  async findPeriodCoveringDate(
    orgId: string,
    onDate: string,
  ): Promise<AccountingPeriod | null> {
    const [row] = await this.db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.orgId, orgId),
          lte(accountingPeriods.startsOn, onDate),
          gte(accountingPeriods.endsOn, onDate),
        ),
      )
      .limit(1);
    return row ? mapPeriod(row) : null;
  }

  async insertPeriod(
    period: Omit<AccountingPeriod, "id"> & { id?: string },
  ): Promise<AccountingPeriod> {
    const [row] = await this.db
      .insert(accountingPeriods)
      .values({
        id: period.id,
        orgId: period.orgId,
        year: period.year,
        month: period.month,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        status: period.status,
      })
      .returning();
    return mapPeriod(row!);
  }

  async setPeriodStatus(
    orgId: string,
    id: string,
    status: PeriodStatus,
  ): Promise<AccountingPeriod> {
    const [row] = await this.db
      .update(accountingPeriods)
      .set({ status })
      .where(and(eq(accountingPeriods.orgId, orgId), eq(accountingPeriods.id, id)))
      .returning();
    if (!row) throw new NotFoundError("Accounting period");
    return mapPeriod(row);
  }

  private async attachLines(
    entries: JournalEntry[],
  ): Promise<JournalWithLines[]> {
    if (entries.length === 0) return [];
    const lines = await this.db
      .select()
      .from(journalLines)
      .where(
        and(
          eq(journalLines.orgId, entries[0]!.orgId),
          inArray(
            journalLines.journalEntryId,
            entries.map((e) => e.id),
          ),
        ),
      )
      .orderBy(asc(journalLines.lineNo));
    const byEntry = new Map<string, JournalLine[]>();
    for (const line of lines.map(mapLine)) {
      const list = byEntry.get(line.journalEntryId) ?? [];
      list.push(line);
      byEntry.set(line.journalEntryId, list);
    }
    return entries.map((e) => ({
      ...e,
      lines: byEntry.get(e.id) ?? [],
    }));
  }

  async findJournalByOutboxEventId(
    orgId: string,
    outboxEventId: string,
  ): Promise<JournalWithLines | null> {
    const [row] = await this.db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          eq(journalEntries.outboxEventId, outboxEventId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [full] = await this.attachLines([mapEntry(row)]);
    return full ?? null;
  }

  async findJournalById(
    orgId: string,
    id: string,
  ): Promise<JournalWithLines | null> {
    const [row] = await this.db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.id, id)))
      .limit(1);
    if (!row) return null;
    const [full] = await this.attachLines([mapEntry(row)]);
    return full ?? null;
  }

  async listJournalsBySourceDocument(
    orgId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): Promise<JournalWithLines[]> {
    const rows = await this.db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          eq(journalEntries.sourceDocumentType, sourceDocumentType),
          eq(journalEntries.sourceDocumentId, sourceDocumentId),
        ),
      )
      .orderBy(asc(journalEntries.createdAt));
    return this.attachLines(rows.map(mapEntry));
  }

  async insertJournal(input: {
    entry: Omit<JournalEntry, "id" | "createdAt"> & { id?: string };
    lines: Array<Omit<JournalLine, "id" | "journalEntryId"> & { id?: string }>;
  }): Promise<JournalWithLines> {
    const [entryRow] = await this.db
      .insert(journalEntries)
      .values({
        id: input.entry.id,
        orgId: input.entry.orgId,
        periodId: input.entry.periodId,
        branchId: input.entry.branchId,
        sourceDocumentType: input.entry.sourceDocumentType,
        sourceDocumentId: input.entry.sourceDocumentId,
        outboxEventId: input.entry.outboxEventId,
        reversesJournalId: input.entry.reversesJournalId,
        postedAt: input.entry.postedAt,
      })
      .returning();
    const entry = mapEntry(entryRow!);
    const lineRows =
      input.lines.length === 0
        ? []
        : await this.db
            .insert(journalLines)
            .values(
              input.lines.map((line) => ({
                id: line.id,
                orgId: line.orgId,
                journalEntryId: entry.id,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                lineNo: line.lineNo,
              })),
            )
            .returning();
    return { ...entry, lines: lineRows.map(mapLine) };
  }

}
