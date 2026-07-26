import { and, eq, inArray, sql } from "drizzle-orm";
import type { CloseChecklistPort } from "@stock-management/application";
import { formatMoney } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  costRevaluations,
  customerReturns,
  goodsReceiptLines,
  goodsReceipts,
  invoiceMatches,
  landedCostDocuments,
  outboxEvents,
  stockAdjustments,
  stockCounts,
  stockIssues,
  stockTransfers,
  supplierInvoices,
  supplierInvoiceLines,
  supplierReturns,
} from "../db/schema/index.js";

export class DrizzleCloseChecklistRepository implements CloseChecklistPort {
  constructor(private readonly db: DbClient) {}

  async countDraftInventoryDocsInRange(
    orgId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<Array<{ documentType: string; count: number }>> {
    const queries: Array<{
      documentType: string;
      promise: Promise<number>;
    }> = [
      {
        documentType: "goods_receipt",
        promise: this.countDraft(goodsReceipts, orgId, startsOn, endsOn),
      },
      {
        documentType: "stock_issue",
        promise: this.countDraft(stockIssues, orgId, startsOn, endsOn),
      },
      {
        documentType: "stock_transfer",
        promise: this.countDraft(stockTransfers, orgId, startsOn, endsOn),
      },
      {
        documentType: "stock_adjustment",
        promise: this.countDraft(stockAdjustments, orgId, startsOn, endsOn),
      },
      {
        documentType: "stock_count",
        promise: this.countDraft(stockCounts, orgId, startsOn, endsOn),
      },
      {
        documentType: "supplier_return",
        promise: this.countDraft(supplierReturns, orgId, startsOn, endsOn),
      },
      {
        documentType: "customer_return",
        promise: this.countDraft(customerReturns, orgId, startsOn, endsOn),
      },
      {
        documentType: "landed_cost",
        promise: this.countDraft(landedCostDocuments, orgId, startsOn, endsOn),
      },
      {
        documentType: "cost_revaluation",
        promise: this.countDraft(costRevaluations, orgId, startsOn, endsOn),
      },
    ];

    const counts = await Promise.all(queries.map((q) => q.promise));
    return queries.flatMap((q, i) =>
      counts[i]! > 0 ? [{ documentType: q.documentType, count: counts[i]! }] : [],
    );
  }

  private async countDraft(
    table:
      | typeof goodsReceipts
      | typeof stockIssues
      | typeof stockTransfers
      | typeof stockAdjustments
      | typeof stockCounts
      | typeof supplierReturns
      | typeof customerReturns
      | typeof landedCostDocuments
      | typeof costRevaluations,
    orgId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(
        and(
          eq(table.orgId, orgId),
          eq(table.status, "draft"),
          sql`${table.createdAt}::date >= ${startsOn}::date`,
          sql`${table.createdAt}::date <= ${endsOn}::date`,
        ),
      );
    return row?.count ?? 0;
  }

  async countOutboxPendingOrFailed(orgId: string): Promise<{
    pending: number;
    failed: number;
  }> {
    const rows = await this.db
      .select({
        status: outboxEvents.status,
        count: sql<number>`count(*)::int`,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.orgId, orgId),
          inArray(outboxEvents.status, ["pending", "failed"]),
        ),
      )
      .groupBy(outboxEvents.status);

    let pending = 0;
    let failed = 0;
    for (const row of rows) {
      if (row.status === "pending") pending = row.count;
      if (row.status === "failed") failed = row.count;
    }
    return { pending, failed };
  }

  async sumUnmatchedPostedGrAmount(orgId: string): Promise<string> {
    const matchedSubquery = this.db
      .select({
        goodsReceiptLineId: invoiceMatches.goodsReceiptLineId,
        orgId: invoiceMatches.orgId,
        matchedSum:
          sql<string>`COALESCE(SUM(${invoiceMatches.matchedAmount}), 0)`.as(
            "matched_sum",
          ),
      })
      .from(invoiceMatches)
      .innerJoin(
        supplierInvoiceLines,
        and(
          eq(invoiceMatches.supplierInvoiceLineId, supplierInvoiceLines.id),
          eq(invoiceMatches.orgId, supplierInvoiceLines.orgId),
        ),
      )
      .innerJoin(
        supplierInvoices,
        and(
          eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
          eq(supplierInvoiceLines.orgId, supplierInvoices.orgId),
        ),
      )
      .where(
        and(
          eq(invoiceMatches.orgId, orgId),
          eq(supplierInvoices.status, "posted"),
        ),
      )
      .groupBy(invoiceMatches.goodsReceiptLineId, invoiceMatches.orgId)
      .as("posted_matches");

    const [row] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(
          GREATEST(
            0,
            ${goodsReceiptLines.qty} * ${goodsReceiptLines.unitCost}
              - COALESCE(${matchedSubquery.matchedSum}, 0)
          )
        ), 0)`.as("total"),
      })
      .from(goodsReceiptLines)
      .innerJoin(
        goodsReceipts,
        and(
          eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id),
          eq(goodsReceiptLines.orgId, goodsReceipts.orgId),
        ),
      )
      .leftJoin(
        matchedSubquery,
        and(
          eq(goodsReceiptLines.id, matchedSubquery.goodsReceiptLineId),
          eq(goodsReceiptLines.orgId, matchedSubquery.orgId),
        ),
      )
      .where(
        and(
          eq(goodsReceiptLines.orgId, orgId),
          eq(goodsReceipts.status, "posted"),
          sql`${goodsReceiptLines.unitCost} IS NOT NULL`,
        ),
      );

    return formatMoney(Number(row?.total ?? 0));
  }

  async countDraftSupplierInvoices(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.orgId, orgId),
          eq(supplierInvoices.status, "draft"),
        ),
      );
    return row?.count ?? 0;
  }
}
