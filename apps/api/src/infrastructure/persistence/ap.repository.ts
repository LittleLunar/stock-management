import { and, asc, eq, sql } from "drizzle-orm";
import type {
  ApPort,
  CreateSupplierInvoiceInput,
  SupplierInvoiceWithLines,
  UpdateSupplierInvoiceInput,
} from "@stock-management/application";
import type {
  InvoiceMatch,
  SupplierInvoice,
  SupplierInvoiceLine,
} from "@stock-management/domain";
import { NotFoundError } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  invoiceMatches,
  supplierInvoiceLines,
  supplierInvoices,
} from "../db/schema/index.js";

function mapInvoice(row: typeof supplierInvoices.$inferSelect): SupplierInvoice {
  return {
    id: row.id,
    orgId: row.orgId,
    supplierId: row.supplierId,
    branchId: row.branchId,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: String(row.invoiceDate),
    dueDate: row.dueDate ? String(row.dueDate) : null,
    status: row.status,
    externalSystem: row.externalSystem,
    externalId: row.externalId,
    postedAt: row.postedAt,
    voidedAt: row.voidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLine(
  row: typeof supplierInvoiceLines.$inferSelect,
): SupplierInvoiceLine {
  return {
    id: row.id,
    orgId: row.orgId,
    supplierInvoiceId: row.supplierInvoiceId,
    productId: row.productId,
    lineNumber: row.lineNumber,
    qty: String(row.qty),
    unitCost: String(row.unitCost),
    amount: String(row.amount),
    purchaseOrderLineId: row.purchaseOrderLineId,
    goodsReceiptLineId: row.goodsReceiptLineId,
  };
}

function mapMatch(row: typeof invoiceMatches.$inferSelect): InvoiceMatch {
  return {
    id: row.id,
    orgId: row.orgId,
    supplierInvoiceLineId: row.supplierInvoiceLineId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    goodsReceiptLineId: row.goodsReceiptLineId,
    matchedQty: String(row.matchedQty),
    matchedAmount: String(row.matchedAmount),
  };
}

export class DrizzleApRepository implements ApPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  async list(orgId: string): Promise<SupplierInvoice[]> {
    const rows = await this.db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.orgId, orgId))
      .orderBy(asc(supplierInvoices.invoiceDate));
    return rows.map(mapInvoice);
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<SupplierInvoiceWithLines | null> {
    const query = this.db
      .select()
      .from(supplierInvoices)
      .where(
        and(eq(supplierInvoices.orgId, orgId), eq(supplierInvoices.id, id)),
      );
    const headerRows = this.lockForUpdate ? await query.for("update") : await query;
    const header = headerRows[0];
    if (!header) return null;

    const lineRows = await this.db
      .select()
      .from(supplierInvoiceLines)
      .where(
        and(
          eq(supplierInvoiceLines.orgId, orgId),
          eq(supplierInvoiceLines.supplierInvoiceId, id),
        ),
      )
      .orderBy(asc(supplierInvoiceLines.lineNumber));

    return {
      ...mapInvoice(header),
      lines: lineRows.map(mapLine),
    };
  }

  async create(
    orgId: string,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines> {
    const [header] = await this.db
      .insert(supplierInvoices)
      .values({
        orgId,
        supplierId: input.supplierId,
        branchId: input.branchId ?? null,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate ?? null,
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        status: "draft",
      })
      .returning();

    await this.insertLines(orgId, header!.id, input.lines);
    return (await this.findById(orgId, header!.id))!;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines> {
    const [header] = await this.db
      .update(supplierInvoices)
      .set({
        ...(input.supplierId !== undefined
          ? { supplierId: input.supplierId }
          : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.invoiceNumber !== undefined
          ? { invoiceNumber: input.invoiceNumber }
          : {}),
        ...(input.invoiceDate !== undefined
          ? { invoiceDate: input.invoiceDate }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.externalSystem !== undefined
          ? { externalSystem: input.externalSystem }
          : {}),
        ...(input.externalId !== undefined
          ? { externalId: input.externalId }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(supplierInvoices.orgId, orgId), eq(supplierInvoices.id, id)),
      )
      .returning();
    if (!header) throw new NotFoundError("Supplier invoice");

    if (input.lines) {
      await this.db
        .delete(supplierInvoiceLines)
        .where(
          and(
            eq(supplierInvoiceLines.orgId, orgId),
            eq(supplierInvoiceLines.supplierInvoiceId, id),
          ),
        );
      await this.insertLines(orgId, id, input.lines);
    }

    return (await this.findById(orgId, id))!;
  }

  async markPosted(
    orgId: string,
    id: string,
    postedAt: Date,
  ): Promise<SupplierInvoice> {
    const [row] = await this.db
      .update(supplierInvoices)
      .set({
        status: "posted",
        postedAt,
        updatedAt: postedAt,
      })
      .where(
        and(eq(supplierInvoices.orgId, orgId), eq(supplierInvoices.id, id)),
      )
      .returning();
    if (!row) throw new NotFoundError("Supplier invoice");
    return mapInvoice(row);
  }

  async markVoided(
    orgId: string,
    id: string,
    voidedAt: Date,
  ): Promise<SupplierInvoice> {
    const [row] = await this.db
      .update(supplierInvoices)
      .set({
        status: "voided",
        voidedAt,
        updatedAt: voidedAt,
      })
      .where(
        and(eq(supplierInvoices.orgId, orgId), eq(supplierInvoices.id, id)),
      )
      .returning();
    if (!row) throw new NotFoundError("Supplier invoice");
    return mapInvoice(row);
  }

  async insertMatches(
    orgId: string,
    matches: Array<Omit<InvoiceMatch, "id"> & { id?: string }>,
  ): Promise<InvoiceMatch[]> {
    const rows: InvoiceMatch[] = [];
    for (const match of matches) {
      const [row] = await this.db
        .insert(invoiceMatches)
        .values({
          id: match.id,
          orgId,
          supplierInvoiceLineId: match.supplierInvoiceLineId,
          purchaseOrderLineId: match.purchaseOrderLineId,
          goodsReceiptLineId: match.goodsReceiptLineId,
          matchedQty: match.matchedQty,
          matchedAmount: match.matchedAmount,
        })
        .returning();
      rows.push(mapMatch(row!));
    }
    return rows;
  }

  async listMatchesForPostedInvoicesByPoLine(
    orgId: string,
    purchaseOrderLineId: string,
  ): Promise<InvoiceMatch[]> {
    const rows = await this.db
      .select({ match: invoiceMatches })
      .from(invoiceMatches)
      .innerJoin(
        supplierInvoiceLines,
        eq(invoiceMatches.supplierInvoiceLineId, supplierInvoiceLines.id),
      )
      .innerJoin(
        supplierInvoices,
        eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(invoiceMatches.orgId, orgId),
          eq(invoiceMatches.purchaseOrderLineId, purchaseOrderLineId),
          eq(supplierInvoices.status, "posted"),
        ),
      );
    return rows.map(({ match }) => mapMatch(match));
  }

  async listMatchesForPostedInvoicesByGrLine(
    orgId: string,
    goodsReceiptLineId: string,
  ): Promise<InvoiceMatch[]> {
    const rows = await this.db
      .select({ match: invoiceMatches })
      .from(invoiceMatches)
      .innerJoin(
        supplierInvoiceLines,
        eq(invoiceMatches.supplierInvoiceLineId, supplierInvoiceLines.id),
      )
      .innerJoin(
        supplierInvoices,
        eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(invoiceMatches.orgId, orgId),
          eq(invoiceMatches.goodsReceiptLineId, goodsReceiptLineId),
          eq(supplierInvoices.status, "posted"),
        ),
      );
    return rows.map(({ match }) => mapMatch(match));
  }

  async sumOpenBalancesByPostedInvoice(orgId: string): Promise<
    Array<{
      invoice: SupplierInvoice;
      openBalance: string;
    }>
  > {
    const rows = await this.db
      .select({
        invoice: supplierInvoices,
        openBalance: sql<string>`coalesce(sum(${supplierInvoiceLines.amount}), 0)`,
      })
      .from(supplierInvoices)
      .innerJoin(
        supplierInvoiceLines,
        eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(supplierInvoices.orgId, orgId),
          eq(supplierInvoices.status, "posted"),
        ),
      )
      .groupBy(supplierInvoices.id)
      .orderBy(asc(supplierInvoices.invoiceDate));

    return rows.map(({ invoice, openBalance }) => ({
      invoice: mapInvoice(invoice),
      openBalance: String(openBalance),
    }));
  }

  private async insertLines(
    orgId: string,
    invoiceId: string,
    lines: CreateSupplierInvoiceInput["lines"],
  ): Promise<void> {
    for (const line of lines) {
      await this.db.insert(supplierInvoiceLines).values({
        orgId,
        supplierInvoiceId: invoiceId,
        productId: line.productId ?? null,
        lineNumber: line.lineNumber,
        qty: line.qty,
        unitCost: line.unitCost,
        amount: line.amount,
        purchaseOrderLineId: line.purchaseOrderLineId,
        goodsReceiptLineId: line.goodsReceiptLineId,
      });
    }
  }
}
