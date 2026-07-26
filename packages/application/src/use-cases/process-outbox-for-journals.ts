import {
  AccountMappingMissingError,
  AccountingPeriodMissingError,
  assertJournalBalanced,
  assertPeriodOpen,
  moneyAbs,
  type JournalLineDraft,
} from "@stock-management/domain";
import type { AccountingPort, JournalWithLines } from "../ports/accounting.js";
import {
  mapOutboxEventToJournalPlan,
  type OutboxLike,
} from "../accounting/journal-event-mapper.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";

export class ProcessOutboxForJournals {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  async execute(event: OutboxLike): Promise<JournalWithLines | null> {
    const plan = mapOutboxEventToJournalPlan(event);
    if (plan.kind === "skip") return null;

    const existing = await this.accounting.findJournalByOutboxEventId(
      event.orgId,
      event.id,
    );
    if (existing) return existing;

    await this.ensureDefaults.execute(event.orgId);

    const mapping = await this.accounting.findMapping(
      event.orgId,
      plan.journalEventType,
    );
    if (!mapping) throw new AccountMappingMissingError(plan.journalEventType);

    const onDate = plan.postedAt.toISOString().slice(0, 10);
    const period = await this.accounting.findPeriodCoveringDate(
      event.orgId,
      onDate,
    );
    if (!period) throw new AccountingPeriodMissingError(onDate);
    assertPeriodOpen(period);

    const amount = moneyAbs(plan.amount);
    const lines: JournalLineDraft[] = [
      {
        accountId: mapping.debitAccountId,
        debit: amount,
        credit: "0",
        lineNo: 1,
      },
      {
        accountId: mapping.creditAccountId,
        debit: "0",
        credit: amount,
        lineNo: 2,
      },
    ];
    assertJournalBalanced(lines);

    let reversesJournalId: string | null = null;
    if (plan.isVoid) {
      const priors = await this.accounting.listJournalsBySourceDocument(
        event.orgId,
        plan.sourceDocumentType,
        plan.sourceDocumentId,
      );
      const original = priors.find((j) => j.reversesJournalId === null);
      reversesJournalId = original?.id ?? null;
    }

    return this.accounting.insertJournal({
      entry: {
        orgId: event.orgId,
        periodId: period.id,
        branchId: plan.branchId,
        sourceDocumentType: plan.sourceDocumentType,
        sourceDocumentId: plan.sourceDocumentId,
        outboxEventId: event.id,
        reversesJournalId,
        postedAt: plan.postedAt,
      },
      lines: lines.map((l) => ({
        orgId: event.orgId,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        lineNo: l.lineNo,
      })),
    });
  }
}
