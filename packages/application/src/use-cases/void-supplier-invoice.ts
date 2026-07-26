import {
  AccountMappingMissingError,
  AccountingPeriodMissingError,
  ConflictError,
  InvoiceAlreadyVoidedError,
  InvoiceNotPostedError,
  NotFoundError,
  assertJournalBalanced,
  assertPeriodOpen,
  moneyAbs,
} from "@stock-management/domain";
import type { IdempotencyInput } from "../dto/inputs.js";
import type { JournalWithLines } from "../ports/accounting.js";
import type { SupplierInvoice } from "@stock-management/domain";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";

const OPERATION = "void-supplier-invoice";

export type VoidSupplierInvoiceResult = {
  invoice: SupplierInvoice;
  reverseJournal: JournalWithLines;
};

export class VoidSupplierInvoice {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  execute(
    orgId: string,
    _userId: string,
    invoiceId: string,
    idempotency?: IdempotencyInput,
  ): Promise<VoidSupplierInvoiceResult> {
    return this.uow.run(async (ctx) => {
      const ap = ctx.ap;
      const accounting = ctx.accounting;
      if (!ap || !accounting) {
        throw new Error("AP and accounting ports are required");
      }

      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as VoidSupplierInvoiceResult;
      }

      const invoice = await ap.findById(orgId, invoiceId);
      if (!invoice) throw new NotFoundError("Supplier invoice");
      if (invoice.status === "voided") {
        throw new InvoiceAlreadyVoidedError("Supplier invoice is already voided");
      }
      if (invoice.status !== "posted") {
        throw new InvoiceNotPostedError("Only posted supplier invoices can be voided");
      }

      await this.ensureDefaults.execute(orgId);

      const journals = await accounting.listJournalsBySourceDocument(
        orgId,
        "supplier_invoice",
        invoiceId,
      );
      const forward = journals.find((j) => j.reversesJournalId == null);
      if (!forward) {
        throw new ConflictError("Forward AP journal missing");
      }

      const existingReverse = journals.find(
        (j) => j.reversesJournalId === forward.id,
      );
      if (existingReverse) {
        const voided = await ap.markVoided(orgId, invoiceId, new Date());
        return { invoice: voided, reverseJournal: existingReverse };
      }

      const mapping = await accounting.findMapping(orgId, "supplier_invoice.voided");
      if (!mapping) throw new AccountMappingMissingError("supplier_invoice.voided");

      const period = await accounting.findPeriodCoveringDate(
        orgId,
        invoice.invoiceDate,
      );
      if (!period) {
        throw new AccountingPeriodMissingError(invoice.invoiceDate);
      }
      assertPeriodOpen(period);

      const total = moneyAbs(
        String(
          forward.lines.reduce((sum, line) => sum + Number(line.debit), 0),
        ),
      );

      const journalLines = [
        {
          orgId,
          accountId: mapping.debitAccountId,
          debit: total,
          credit: "0",
          lineNo: 1,
        },
        {
          orgId,
          accountId: mapping.creditAccountId,
          debit: "0",
          credit: total,
          lineNo: 2,
        },
      ];
      assertJournalBalanced(journalLines);

      const voidedAt = new Date();
      const reverseJournal = await accounting.insertJournal({
        entry: {
          orgId,
          periodId: period.id,
          branchId: invoice.branchId,
          sourceDocumentType: "supplier_invoice",
          sourceDocumentId: invoice.id,
          outboxEventId: null,
          reversesJournalId: forward.id,
          postedAt: voidedAt,
        },
        lines: journalLines,
      });

      const voidedInvoice = await ap.markVoided(orgId, invoiceId, voidedAt);
      const result: VoidSupplierInvoiceResult = {
        invoice: voidedInvoice,
        reverseJournal,
      };

      if (idempotency) {
        await ctx.idempotency.save({
          orgId,
          operation: OPERATION,
          externalSystem: idempotency.externalSystem,
          externalId: idempotency.externalId,
          result,
        });
      }

      return result;
    });
  }
}
