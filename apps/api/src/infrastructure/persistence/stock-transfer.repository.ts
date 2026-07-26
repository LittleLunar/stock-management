import { and, eq, inArray } from "drizzle-orm";
import type {
  CreateStockTransferInput,
  StockTransferPort,
  StockTransferWithLines,
  UpdateStockTransferInput,
} from "@stock-management/application";
import type {
  StockTransfer,
  StockTransferLine,
} from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  stockTransferLines,
  stockTransferSerials,
  stockTransfers,
} from "../db/schema/index.js";

type LineInput = CreateStockTransferInput["lines"][number];

export class DrizzleStockTransferRepository implements StockTransferPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string): Promise<StockTransfer[]> {
    return this.db
      .select()
      .from(stockTransfers)
      .where(eq(stockTransfers.orgId, orgId)) as Promise<StockTransfer[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<StockTransferWithLines | null> {
    const query = this.db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.orgId, orgId), eq(stockTransfers.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const transfer = rows[0] as StockTransfer | undefined;
    if (!transfer) return null;

    const lines = (await this.db
      .select()
      .from(stockTransferLines)
      .where(
        and(
          eq(stockTransferLines.orgId, orgId),
          eq(stockTransferLines.stockTransferId, id),
        ),
      )) as StockTransferLine[];
    const serialNumbers = await this.serialsByLine(
      orgId,
      lines.map(({ id }) => id),
    );
    return {
      ...transfer,
      lines: lines.map((line) => ({
        ...line,
        serialNumbers: serialNumbers.get(line.id) ?? [],
      })),
    };
  }

  create(
    orgId: string,
    input: CreateStockTransferInput,
  ): Promise<StockTransferWithLines> {
    return this.inTransaction(async (client) => {
      const [transfer] = await client
        .insert(stockTransfers)
        .values({
          orgId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          transitLocationId: input.transitLocationId,
          documentNumber: input.documentNumber ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, transfer.id, input.lines);
      return new DrizzleStockTransferRepository(client).findById(
        orgId,
        transfer.id,
      ) as Promise<StockTransferWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateStockTransferInput,
  ): Promise<StockTransferWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(stockTransfers)
        .set({
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          transitLocationId: input.transitLocationId,
          documentNumber: input.documentNumber,
          updatedAt: new Date(),
        })
        .where(and(eq(stockTransfers.orgId, orgId), eq(stockTransfers.id, id)))
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await this.replaceLines(client, orgId, id, input.lines);
      }
      return new DrizzleStockTransferRepository(client).findById(
        orgId,
        id,
      ) as Promise<StockTransferWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: StockTransfer["status"],
    occurredAt: Date,
  ): Promise<StockTransfer> {
    const [transfer] = await this.db
      .update(stockTransfers)
      .set({
        status,
        shippedAt: status === "in_transit" ? occurredAt : undefined,
        receivedAt: status === "received" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(stockTransfers.orgId, orgId), eq(stockTransfers.id, id)))
      .returning();
    if (!transfer) throw new Error("Stock transfer not found");
    return transfer as StockTransfer;
  }

  private async serialsByLine(orgId: string, lineIds: string[]) {
    const result = new Map<string, string[]>();
    if (!lineIds.length) return result;
    const rows = await this.db
      .select()
      .from(stockTransferSerials)
      .where(
        and(
          eq(stockTransferSerials.orgId, orgId),
          inArray(stockTransferSerials.stockTransferLineId, lineIds),
        ),
      );
    for (const row of rows) {
      const values = result.get(row.stockTransferLineId) ?? [];
      values.push(row.serialNumber);
      result.set(row.stockTransferLineId, values);
    }
    return result;
  }

  private async replaceLines(
    client: DbClient,
    orgId: string,
    transferId: string,
    lines: LineInput[],
  ): Promise<void> {
    const existing = await client
      .select({ id: stockTransferLines.id })
      .from(stockTransferLines)
      .where(
        and(
          eq(stockTransferLines.orgId, orgId),
          eq(stockTransferLines.stockTransferId, transferId),
        ),
      );
    const lineIds = existing.map(({ id }) => id);
    if (lineIds.length) {
      await client
        .delete(stockTransferSerials)
        .where(
          and(
            eq(stockTransferSerials.orgId, orgId),
            inArray(stockTransferSerials.stockTransferLineId, lineIds),
          ),
        );
    }
    await client
      .delete(stockTransferLines)
      .where(
        and(
          eq(stockTransferLines.orgId, orgId),
          eq(stockTransferLines.stockTransferId, transferId),
        ),
      );
    await this.insertLines(client, orgId, transferId, lines);
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    transferId: string,
    lines: LineInput[],
  ): Promise<void> {
    for (const input of lines) {
      const [line] = await client
        .insert(stockTransferLines)
        .values({
          id: input.id,
          orgId,
          stockTransferId: transferId,
          productId: input.productId,
          qty: input.qty,
          lotId: input.lotId ?? null,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(stockTransferSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            stockTransferLineId: line.id,
            serialNumber,
          })),
        );
      }
    }
  }

  private inTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
    if ("transaction" in this.db) {
      return (this.db as Db).transaction((tx) => fn(tx));
    }
    return fn(this.db as DbTransaction);
  }
}
