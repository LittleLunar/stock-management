import { and, eq, inArray } from "drizzle-orm";
import type {
  BranchListFilter,
  CreateGoodsReceiptInput,
  GoodsReceiptPort,
  GoodsReceiptWithLines,
  UpdateGoodsReceiptInput,
} from "@stock-management/application";
import type { GoodsReceipt, GoodsReceiptLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  goodsReceiptLines,
  goodsReceiptSerials,
  goodsReceipts,
  lots,
} from "../db/schema/index.js";

type ReceiptLineInput = CreateGoodsReceiptInput["lines"][number];

export class DrizzleGoodsReceiptRepository implements GoodsReceiptPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string, filter?: BranchListFilter): Promise<GoodsReceipt[]> {
    const conditions = [eq(goodsReceipts.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(goodsReceipts.branchId, filter.branchId));
    }
    return this.db
      .select()
      .from(goodsReceipts)
      .where(and(...conditions)) as Promise<GoodsReceipt[]>;
  }

  async findById(orgId: string, id: string): Promise<GoodsReceiptWithLines | null> {
    const query = this.db
      .select()
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.orgId, orgId), eq(goodsReceipts.id, id)));
    const receiptRows = this.lockForUpdate ? await query.for("update") : await query;
    const receipt = receiptRows[0] as GoodsReceipt | undefined;
    if (!receipt) return null;

    const lineRows = await this.db
      .select({
        line: goodsReceiptLines,
        lotCode: lots.lotCode,
        expiryDate: lots.expiryDate,
      })
      .from(goodsReceiptLines)
      .leftJoin(
        lots,
        and(
          eq(lots.orgId, orgId),
          eq(lots.id, goodsReceiptLines.lotId),
          eq(lots.productId, goodsReceiptLines.productId),
        ),
      )
      .where(
        and(
          eq(goodsReceiptLines.orgId, orgId),
          eq(goodsReceiptLines.goodsReceiptId, id),
        ),
      );
    const lineIds = lineRows.map(({ line }) => line.id);
    const serialRows = lineIds.length
      ? await this.db
          .select()
          .from(goodsReceiptSerials)
          .where(
            and(
              eq(goodsReceiptSerials.orgId, orgId),
              inArray(goodsReceiptSerials.goodsReceiptLineId, lineIds),
            ),
          )
      : [];
    const serialNumbers = new Map<string, string[]>();
    for (const serial of serialRows) {
      const values = serialNumbers.get(serial.goodsReceiptLineId) ?? [];
      values.push(serial.serialNumber);
      serialNumbers.set(serial.goodsReceiptLineId, values);
    }

    return {
      ...receipt,
      lines: lineRows.map(({ line, lotCode, expiryDate }) => ({
        ...(line as GoodsReceiptLine),
        lotCode,
        expiryDate,
        serialNumbers: serialNumbers.get(line.id) ?? [],
      })),
    };
  }

  async findLineById(
    orgId: string,
    id: string,
  ): Promise<GoodsReceiptLine | null> {
    const query = this.db
      .select()
      .from(goodsReceiptLines)
      .where(
        and(eq(goodsReceiptLines.orgId, orgId), eq(goodsReceiptLines.id, id)),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const line = rows[0];
    return line ? (line as GoodsReceiptLine) : null;
  }

  create(orgId: string, input: CreateGoodsReceiptInput): Promise<GoodsReceiptWithLines> {
    return this.inTransaction(async (client) => {
      const [receipt] = await client
        .insert(goodsReceipts)
        .values({
          orgId,
          purchaseOrderId: input.purchaseOrderId ?? null,
          supplierId: input.supplierId ?? null,
          branchId: input.branchId,
          locationId: input.locationId,
        })
        .returning();
      await this.insertLines(client, orgId, receipt.id, input.lines);
      return new DrizzleGoodsReceiptRepository(client).findById(
        orgId,
        receipt.id,
      ) as Promise<GoodsReceiptWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateGoodsReceiptInput,
  ): Promise<GoodsReceiptWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(goodsReceipts)
        .set({
          purchaseOrderId: input.purchaseOrderId,
          supplierId: input.supplierId,
          branchId: input.branchId,
          locationId: input.locationId,
          updatedAt: new Date(),
        })
        .where(and(eq(goodsReceipts.orgId, orgId), eq(goodsReceipts.id, id)))
        .returning();
      if (!updated) return null;

      if (input.lines) {
        const existingLines = await client
          .select({ id: goodsReceiptLines.id })
          .from(goodsReceiptLines)
          .where(
            and(
              eq(goodsReceiptLines.orgId, orgId),
              eq(goodsReceiptLines.goodsReceiptId, id),
            ),
          );
        const lineIds = existingLines.map((line) => line.id);
        if (lineIds.length) {
          await client
            .delete(goodsReceiptSerials)
            .where(
              and(
                eq(goodsReceiptSerials.orgId, orgId),
                inArray(goodsReceiptSerials.goodsReceiptLineId, lineIds),
              ),
            );
        }
        await client
          .delete(goodsReceiptLines)
          .where(
            and(
              eq(goodsReceiptLines.orgId, orgId),
              eq(goodsReceiptLines.goodsReceiptId, id),
            ),
          );
        await this.insertLines(client, orgId, id, input.lines);
      }

      return new DrizzleGoodsReceiptRepository(client).findById(
        orgId,
        id,
      ) as Promise<GoodsReceiptWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: GoodsReceipt["status"],
    occurredAt: Date,
  ): Promise<GoodsReceipt> {
    const [receipt] = await this.db
      .update(goodsReceipts)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(goodsReceipts.orgId, orgId), eq(goodsReceipts.id, id)))
      .returning();
    if (!receipt) throw new Error("Goods receipt not found");
    return receipt as GoodsReceipt;
  }

  async setLineLotId(orgId: string, lineId: string, lotId: string): Promise<void> {
    await this.db
      .update(goodsReceiptLines)
      .set({ lotId, updatedAt: new Date() })
      .where(and(eq(goodsReceiptLines.orgId, orgId), eq(goodsReceiptLines.id, lineId)));
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    receiptId: string,
    lines: ReceiptLineInput[],
  ): Promise<void> {
    for (const input of lines) {
      const lotId = await this.resolveLotId(client, orgId, input);
      const [line] = await client
        .insert(goodsReceiptLines)
        .values({
          id: input.id,
          orgId,
          goodsReceiptId: receiptId,
          productId: input.productId,
          purchaseOrderLineId: input.purchaseOrderLineId ?? null,
          qty: input.qty,
          unitCost: input.unitCost ?? null,
          lotId,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(goodsReceiptSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            goodsReceiptLineId: line.id,
            serialNumber,
          })),
        );
      }
    }
  }

  private async resolveLotId(
    client: DbClient,
    orgId: string,
    input: ReceiptLineInput,
  ): Promise<string | null> {
    if (input.lotId) {
      const [lot] = await client
        .select({ id: lots.id })
        .from(lots)
        .where(
          and(
            eq(lots.orgId, orgId),
            eq(lots.productId, input.productId),
            eq(lots.id, input.lotId),
          ),
        );
      if (!lot) throw new Error("Lot not found");
      return lot.id;
    }
    if (!input.lotCode) return null;
    const [lot] = await client
      .insert(lots)
      .values({
        orgId,
        productId: input.productId,
        lotCode: input.lotCode,
        expiryDate: input.expiryDate ?? null,
      })
      .onConflictDoUpdate({
        target: [lots.orgId, lots.productId, lots.lotCode],
        set: { expiryDate: input.expiryDate ?? null, updatedAt: new Date() },
      })
      .returning();
    return lot.id;
  }

  private inTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
    if ("transaction" in this.db) {
      return (this.db as Db).transaction((tx) => fn(tx));
    }
    return fn(this.db as DbTransaction);
  }
}
