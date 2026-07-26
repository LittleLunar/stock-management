import { and, eq } from "drizzle-orm";
import type {
  BranchListFilter,
  CreatePurchaseOrderInput,
  PurchaseOrderPort,
  PurchaseOrderWithLines,
  UpdatePurchaseOrderInput,
} from "@stock-management/application";
import type { PurchaseOrder, PurchaseOrderLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import { purchaseOrderLines, purchaseOrders } from "../db/schema/index.js";

export class DrizzlePurchaseOrderRepository implements PurchaseOrderPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string, filter?: BranchListFilter): Promise<PurchaseOrder[]> {
    const conditions = [eq(purchaseOrders.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(purchaseOrders.branchId, filter.branchId));
    }
    return this.db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions)) as Promise<PurchaseOrder[]>;
  }

  async findById(orgId: string, id: string): Promise<PurchaseOrderWithLines | null> {
    const query = this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const purchaseOrder = rows[0] as PurchaseOrder | undefined;
    if (!purchaseOrder) return null;

    const lines = (await this.db
      .select()
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.orgId, orgId),
          eq(purchaseOrderLines.purchaseOrderId, id),
        ),
      )) as PurchaseOrderLine[];
    return { ...purchaseOrder, lines };
  }

  async findLineById(orgId: string, id: string): Promise<PurchaseOrderLine | null> {
    const query = this.db
      .select()
      .from(purchaseOrderLines)
      .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    return (rows[0] as PurchaseOrderLine | undefined) ?? null;
  }

  create(
    orgId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines> {
    return this.inTransaction((client) => this.insert(orgId, input, client));
  }

  update(
    orgId: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(purchaseOrders)
        .set({
          supplierId: input.supplierId,
          branchId: input.branchId,
          documentNumber: input.documentNumber,
          expectedDate: input.expectedDate,
          updatedAt: new Date(),
        })
        .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
        .returning();
      if (!updated) return null;

      if (input.lines) {
        await client
          .delete(purchaseOrderLines)
          .where(
            and(
              eq(purchaseOrderLines.orgId, orgId),
              eq(purchaseOrderLines.purchaseOrderId, id),
            ),
          );
        if (input.lines.length) {
          await client.insert(purchaseOrderLines).values(
            input.lines.map((line) => ({
              id: line.id,
              orgId,
              purchaseOrderId: id,
              productId: line.productId,
              orderedQty: line.orderedQty,
              unitCost: line.unitCost ?? null,
              lineNumber: line.lineNumber,
            })),
          );
        }
      }

      return new DrizzlePurchaseOrderRepository(client).findById(orgId, id) as Promise<
        PurchaseOrderWithLines
      >;
    });
  }

  async updateLineReceivedQty(
    orgId: string,
    lineId: string,
    receivedQty: string,
  ): Promise<PurchaseOrderLine> {
    const [line] = await this.db
      .update(purchaseOrderLines)
      .set({ receivedQty, updatedAt: new Date() })
      .where(
        and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.id, lineId)),
      )
      .returning();
    if (!line) throw new Error("Purchase order line not found");
    return line as PurchaseOrderLine;
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: PurchaseOrder["status"],
  ): Promise<PurchaseOrder> {
    const [purchaseOrder] = await this.db
      .update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
      .returning();
    if (!purchaseOrder) throw new Error("Purchase order not found");
    return purchaseOrder as PurchaseOrder;
  }

  private async insert(
    orgId: string,
    input: CreatePurchaseOrderInput,
    client: DbClient,
  ): Promise<PurchaseOrderWithLines> {
    const [purchaseOrder] = await client
      .insert(purchaseOrders)
      .values({
        orgId,
        supplierId: input.supplierId,
        branchId: input.branchId,
        documentNumber: input.documentNumber ?? null,
        expectedDate: input.expectedDate ?? null,
      })
      .returning();

    const lines = input.lines.length
      ? await client
          .insert(purchaseOrderLines)
          .values(
            input.lines.map((line) => ({
              id: line.id,
              orgId,
              purchaseOrderId: purchaseOrder.id,
              productId: line.productId,
              orderedQty: line.orderedQty,
              unitCost: line.unitCost ?? null,
              lineNumber: line.lineNumber,
            })),
          )
          .returning()
      : [];
    return {
      ...(purchaseOrder as PurchaseOrder),
      lines: lines as PurchaseOrderLine[],
    };
  }

  private inTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
    if ("transaction" in this.db) {
      return (this.db as Db).transaction((tx) => fn(tx));
    }
    return fn(this.db as DbTransaction);
  }
}
