import { and, eq } from "drizzle-orm";
import type {
  BranchListFilter,
  CreateStockCountSnapshotInput,
  StockCountPort,
  StockCountWithLines,
  UpdateStockCountSnapshotInput,
} from "@stock-management/application";
import type { StockCount, StockCountLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import { stockCountLines, stockCounts } from "../db/schema/index.js";

type LineInput = CreateStockCountSnapshotInput["lines"][number];

export class DrizzleStockCountRepository implements StockCountPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string, filter?: BranchListFilter): Promise<StockCount[]> {
    const conditions = [eq(stockCounts.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(stockCounts.branchId, filter.branchId));
    }
    return this.db
      .select()
      .from(stockCounts)
      .where(and(...conditions)) as Promise<StockCount[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<StockCountWithLines | null> {
    const query = this.db
      .select()
      .from(stockCounts)
      .where(and(eq(stockCounts.orgId, orgId), eq(stockCounts.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const count = rows[0] as StockCount | undefined;
    if (!count) return null;

    const lines = (await this.db
      .select()
      .from(stockCountLines)
      .where(
        and(
          eq(stockCountLines.orgId, orgId),
          eq(stockCountLines.stockCountId, id),
        ),
      )) as StockCountLine[];
    return { ...count, lines };
  }

  create(
    orgId: string,
    input: CreateStockCountSnapshotInput,
  ): Promise<StockCountWithLines> {
    return this.inTransaction(async (client) => {
      const [count] = await client
        .insert(stockCounts)
        .values({
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, count.id, input.lines);
      return new DrizzleStockCountRepository(client).findById(
        orgId,
        count.id,
      ) as Promise<StockCountWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateStockCountSnapshotInput,
  ): Promise<StockCountWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(stockCounts)
        .set({
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber,
          updatedAt: new Date(),
        })
        .where(and(eq(stockCounts.orgId, orgId), eq(stockCounts.id, id)))
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await client
          .delete(stockCountLines)
          .where(
            and(
              eq(stockCountLines.orgId, orgId),
              eq(stockCountLines.stockCountId, id),
            ),
          );
        await this.insertLines(client, orgId, id, input.lines);
      }
      return new DrizzleStockCountRepository(client).findById(
        orgId,
        id,
      ) as Promise<StockCountWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: StockCount["status"],
    occurredAt: Date,
  ): Promise<StockCount> {
    const [count] = await this.db
      .update(stockCounts)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(stockCounts.orgId, orgId), eq(stockCounts.id, id)))
      .returning();
    if (!count) throw new Error("Stock count not found");
    return count as StockCount;
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    countId: string,
    lines: LineInput[],
  ): Promise<void> {
    if (!lines.length) return;
    await client.insert(stockCountLines).values(
      lines.map((line) => ({
        id: line.id,
        orgId,
        stockCountId: countId,
        productId: line.productId,
        lotId: line.lotId ?? null,
        expectedQty: line.expectedQty,
        countedQty: line.countedQty,
        unitCost: line.unitCost ?? null,
        lineNumber: line.lineNumber,
      })),
    );
  }

  private inTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
    if ("transaction" in this.db) {
      return (this.db as Db).transaction((tx) => fn(tx));
    }
    return fn(this.db as DbTransaction);
  }
}
