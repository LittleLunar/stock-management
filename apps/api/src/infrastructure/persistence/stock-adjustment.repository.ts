import { and, eq, inArray } from "drizzle-orm";
import type {
  BranchListFilter,
  CreateStockAdjustmentInput,
  StockAdjustmentPort,
  StockAdjustmentWithLines,
  UpdateStockAdjustmentInput,
} from "@stock-management/application";
import type {
  StockAdjustment,
  StockAdjustmentLine,
} from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  stockAdjustmentLines,
  stockAdjustmentSerials,
  stockAdjustments,
} from "../db/schema/index.js";

type LineInput = CreateStockAdjustmentInput["lines"][number];

export class DrizzleStockAdjustmentRepository implements StockAdjustmentPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string, filter?: BranchListFilter): Promise<StockAdjustment[]> {
    const conditions = [eq(stockAdjustments.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(stockAdjustments.branchId, filter.branchId));
    }
    return this.db
      .select()
      .from(stockAdjustments)
      .where(and(...conditions)) as Promise<StockAdjustment[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<StockAdjustmentWithLines | null> {
    const query = this.db
      .select()
      .from(stockAdjustments)
      .where(
        and(eq(stockAdjustments.orgId, orgId), eq(stockAdjustments.id, id)),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const adjustment = rows[0] as StockAdjustment | undefined;
    if (!adjustment) return null;

    const lines = (await this.db
      .select()
      .from(stockAdjustmentLines)
      .where(
        and(
          eq(stockAdjustmentLines.orgId, orgId),
          eq(stockAdjustmentLines.stockAdjustmentId, id),
        ),
      )) as StockAdjustmentLine[];
    const serialNumbers = await this.serialsByLine(
      orgId,
      lines.map(({ id }) => id),
    );
    return {
      ...adjustment,
      lines: lines.map((line) => ({
        ...line,
        serialNumbers: serialNumbers.get(line.id) ?? [],
      })),
    };
  }

  create(
    orgId: string,
    input: CreateStockAdjustmentInput,
  ): Promise<StockAdjustmentWithLines> {
    return this.inTransaction(async (client) => {
      const [adjustment] = await client
        .insert(stockAdjustments)
        .values({
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber ?? null,
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, adjustment.id, input.lines);
      return new DrizzleStockAdjustmentRepository(client).findById(
        orgId,
        adjustment.id,
      ) as Promise<StockAdjustmentWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateStockAdjustmentInput,
  ): Promise<StockAdjustmentWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(stockAdjustments)
        .set({
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber,
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
          updatedAt: new Date(),
        })
        .where(
          and(eq(stockAdjustments.orgId, orgId), eq(stockAdjustments.id, id)),
        )
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await this.replaceLines(client, orgId, id, input.lines);
      }
      return new DrizzleStockAdjustmentRepository(client).findById(
        orgId,
        id,
      ) as Promise<StockAdjustmentWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: StockAdjustment["status"],
    occurredAt: Date,
  ): Promise<StockAdjustment> {
    const [adjustment] = await this.db
      .update(stockAdjustments)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(
        and(eq(stockAdjustments.orgId, orgId), eq(stockAdjustments.id, id)),
      )
      .returning();
    if (!adjustment) throw new Error("Stock adjustment not found");
    return adjustment as StockAdjustment;
  }

  private async serialsByLine(orgId: string, lineIds: string[]) {
    const result = new Map<string, string[]>();
    if (!lineIds.length) return result;
    const rows = await this.db
      .select()
      .from(stockAdjustmentSerials)
      .where(
        and(
          eq(stockAdjustmentSerials.orgId, orgId),
          inArray(stockAdjustmentSerials.stockAdjustmentLineId, lineIds),
        ),
      );
    for (const row of rows) {
      const values = result.get(row.stockAdjustmentLineId) ?? [];
      values.push(row.serialNumber);
      result.set(row.stockAdjustmentLineId, values);
    }
    return result;
  }

  private async replaceLines(
    client: DbClient,
    orgId: string,
    adjustmentId: string,
    lines: LineInput[],
  ): Promise<void> {
    const existing = await client
      .select({ id: stockAdjustmentLines.id })
      .from(stockAdjustmentLines)
      .where(
        and(
          eq(stockAdjustmentLines.orgId, orgId),
          eq(stockAdjustmentLines.stockAdjustmentId, adjustmentId),
        ),
      );
    const lineIds = existing.map(({ id }) => id);
    if (lineIds.length) {
      await client
        .delete(stockAdjustmentSerials)
        .where(
          and(
            eq(stockAdjustmentSerials.orgId, orgId),
            inArray(stockAdjustmentSerials.stockAdjustmentLineId, lineIds),
          ),
        );
    }
    await client
      .delete(stockAdjustmentLines)
      .where(
        and(
          eq(stockAdjustmentLines.orgId, orgId),
          eq(stockAdjustmentLines.stockAdjustmentId, adjustmentId),
        ),
      );
    await this.insertLines(client, orgId, adjustmentId, lines);
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    adjustmentId: string,
    lines: LineInput[],
  ): Promise<void> {
    for (const input of lines) {
      const [line] = await client
        .insert(stockAdjustmentLines)
        .values({
          id: input.id,
          orgId,
          stockAdjustmentId: adjustmentId,
          productId: input.productId,
          qty: input.qty,
          lotId: input.lotId ?? null,
          unitCost: input.unitCost ?? null,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(stockAdjustmentSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            stockAdjustmentLineId: line.id,
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
