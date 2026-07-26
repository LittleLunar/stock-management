import {
  AccountMappingMissingError,
  AccountingPeriodMissingError,
  InvoiceNotDraftError,
  NotFoundError,
  ThreeWayMatchError,
  assertJournalBalanced,
  assertPeriodOpen,
  moneyAbs,
  planThreeWayMatches,
  type MatchLineInput,
} from "@stock-management/domain";
import type { IdempotencyInput } from "../dto/inputs.js";
import type { JournalWithLines } from "../ports/accounting.js";
import type { SupplierInvoiceWithLines } from "../ports/ap.js";
import type { InvoiceMatch, MatchLineContext } from "@stock-management/domain";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";

const OPERATION = "post-supplier-invoice";

export type PostSupplierInvoiceResult = {
  invoice: SupplierInvoiceWithLines;
  matches: InvoiceMatch[];
  journal: JournalWithLines;
};

function sumAmounts(lines: Array<{ amount: string }>): string {
  return String(lines.reduce((sum, line) => sum + Number(line.amount), 0));
}

function sumMatched(matches: Array<{ matchedQty: string; matchedAmount: string }>) {
  return matches.reduce(
    (acc, match) => ({
      qty: String(Number(acc.qty) + Number(match.matchedQty)),
      amount: String(Number(acc.amount) + Number(match.matchedAmount)),
    }),
    { qty: "0", amount: "0" },
  );
}

export class PostSupplierInvoice {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  execute(
    orgId: string,
    _userId: string,
    invoiceId: string,
    idempotency?: IdempotencyInput,
  ): Promise<PostSupplierInvoiceResult> {
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
        if (existing) return existing.result as PostSupplierInvoiceResult;
      }

      const invoice = await ap.findById(orgId, invoiceId);
      if (!invoice) throw new NotFoundError("Supplier invoice");
      if (invoice.status !== "draft") {
        throw new InvoiceNotDraftError("Only draft supplier invoices can be posted");
      }

      await this.ensureDefaults.execute(orgId);

      const matchInputs: MatchLineInput[] = invoice.lines.map((line) => ({
        lineNumber: line.lineNumber,
        qty: line.qty,
        unitCost: line.unitCost,
        amount: line.amount,
        purchaseOrderLineId: line.purchaseOrderLineId,
        goodsReceiptLineId: line.goodsReceiptLineId,
        productId: line.productId,
      }));

      const contextByLineNumber = new Map<number, MatchLineContext>();
      for (const line of matchInputs) {
        const poLine = await ctx.po.findLineById(orgId, line.purchaseOrderLineId);
        if (!poLine) throw new NotFoundError("Purchase order line");

        const grLine = await ctx.gr.findLineById(orgId, line.goodsReceiptLineId);
        if (!grLine) throw new NotFoundError("Goods receipt line");

        const gr = await ctx.gr.findById(orgId, grLine.goodsReceiptId);
        if (!gr) throw new NotFoundError("Goods receipt");

        if (gr.supplierId && gr.supplierId !== invoice.supplierId) {
          throw new ThreeWayMatchError(
            "Invoice supplier must match goods receipt supplier",
          );
        }

        const poMatches = await ap.listMatchesForPostedInvoicesByPoLine(
          orgId,
          line.purchaseOrderLineId,
        );
        const grMatches = await ap.listMatchesForPostedInvoicesByGrLine(
          orgId,
          line.goodsReceiptLineId,
        );

        contextByLineNumber.set(line.lineNumber, {
          poLine: {
            id: poLine.id,
            orderedQty: poLine.orderedQty,
            unitCost: poLine.unitCost,
            productId: poLine.productId,
            purchaseOrderId: poLine.purchaseOrderId,
          },
          grLine: {
            id: grLine.id,
            qty: grLine.qty,
            unitCost: grLine.unitCost,
            productId: grLine.productId,
            purchaseOrderLineId: grLine.purchaseOrderLineId,
            goodsReceiptId: grLine.goodsReceiptId,
          },
          gr: {
            id: gr.id,
            status: gr.status,
            supplierId: gr.supplierId,
          },
          matchedOnPo: sumMatched(poMatches),
          matchedOnGr: sumMatched(grMatches),
        });
      }

      const plans = planThreeWayMatches(matchInputs, (line) => {
        const context = contextByLineNumber.get(line.lineNumber);
        if (!context) {
          throw new Error(`Missing match context for line ${line.lineNumber}`);
        }
        return context;
      });

      const lineByNumber = new Map(
        invoice.lines.map((line) => [line.lineNumber, line]),
      );
      const matches = await ap.insertMatches(
        orgId,
        plans.map((plan) => {
          const invoiceLine = lineByNumber.get(plan.lineNumber);
          if (!invoiceLine) {
            throw new Error(`Missing invoice line ${plan.lineNumber}`);
          }
          return {
            orgId,
            supplierInvoiceLineId: invoiceLine.id,
            purchaseOrderLineId: plan.purchaseOrderLineId,
            goodsReceiptLineId: plan.goodsReceiptLineId,
            matchedQty: plan.matchedQty,
            matchedAmount: plan.matchedAmount,
          };
        }),
      );

      const postedAt = new Date();
      await ap.markPosted(orgId, invoiceId, postedAt);

      const mapping = await accounting.findMapping(orgId, "supplier_invoice.posted");
      if (!mapping) throw new AccountMappingMissingError("supplier_invoice.posted");

      const period = await accounting.findPeriodCoveringDate(
        orgId,
        invoice.invoiceDate,
      );
      if (!period) {
        throw new AccountingPeriodMissingError(invoice.invoiceDate);
      }
      assertPeriodOpen(period);

      const total = moneyAbs(sumAmounts(invoice.lines));
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

      const journal = await accounting.insertJournal({
        entry: {
          orgId,
          periodId: period.id,
          branchId: invoice.branchId,
          sourceDocumentType: "supplier_invoice",
          sourceDocumentId: invoice.id,
          outboxEventId: null,
          reversesJournalId: null,
          postedAt,
        },
        lines: journalLines,
      });

      const updated = (await ap.findById(orgId, invoiceId))!;
      const result: PostSupplierInvoiceResult = {
        invoice: updated,
        matches,
        journal,
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
