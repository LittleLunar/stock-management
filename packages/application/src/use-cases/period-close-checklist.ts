import { NotFoundError } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";
import type {
  CloseChecklistPort,
  CloseChecklistReport,
  CloseChecklistWarning,
} from "../ports/close-checklist.js";

export class PeriodCloseChecklistUseCase {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly checklist: CloseChecklistPort,
  ) {}

  async execute(orgId: string, periodId: string): Promise<CloseChecklistReport> {
    const periods = await this.accounting.listPeriods(orgId);
    const period = periods.find((p) => p.id === periodId);
    if (!period) throw new NotFoundError("AccountingPeriod");

    const warnings: CloseChecklistWarning[] = [];

    const drafts = await this.checklist.countDraftInventoryDocsInRange(
      orgId,
      period.startsOn,
      period.endsOn,
    );
    for (const row of drafts) {
      if (row.count > 0) {
        warnings.push({
          code: "UNPOSTED_INVENTORY_DOCS",
          message: `${row.count} draft ${row.documentType} document(s) dated in period`,
          count: row.count,
          documentType: row.documentType,
        });
      }
    }

    const outbox = await this.checklist.countOutboxPendingOrFailed(orgId);
    if (outbox.pending + outbox.failed > 0) {
      warnings.push({
        code: "OUTBOX_PENDING_OR_FAILED",
        message: `${outbox.pending} pending and ${outbox.failed} failed outbox event(s)`,
        count: outbox.pending + outbox.failed,
      });
    }

    const grni = await this.checklist.sumUnmatchedPostedGrAmount(orgId);
    if (Number(grni) > 0) {
      warnings.push({
        code: "UNMATCHED_GRNI",
        message: `Unmatched posted GR value (GRNI) ${grni}`,
        amount: grni,
      });
    }

    const draftInvoices = await this.checklist.countDraftSupplierInvoices(orgId);
    if (draftInvoices > 0) {
      warnings.push({
        code: "DRAFT_SUPPLIER_INVOICES",
        message: `${draftInvoices} draft supplier invoice(s)`,
        count: draftInvoices,
      });
    }

    return {
      periodId: period.id,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      warnings,
      canCloseSuggested: warnings.length === 0,
    };
  }
}
