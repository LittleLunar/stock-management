import { and, eq, inArray } from "drizzle-orm";
import type {
  BranchListFilter,
  CreateSupplierReturnInput,
  SupplierReturnPort,
  SupplierReturnWithLines,
  UpdateSupplierReturnInput,
} from "@stock-management/application";
import type { SupplierReturn, SupplierReturnLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  supplierReturnLines,
  supplierReturnSerials,
  supplierReturns,
} from "../db/schema/index.js";

type LineInput = CreateSupplierReturnInput["lines"][number];

export class DrizzleSupplierReturnRepository implements SupplierReturnPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string, filter?: BranchListFilter): Promise<SupplierReturn[]> {
    const conditions = [eq(supplierReturns.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(supplierReturns.branchId, filter.branchId));
    }
    return this.db
      .select()
      .from(supplierReturns)
      .where(and(...conditions)) as Promise<SupplierReturn[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<SupplierReturnWithLines | null> {
    const query = this.db
      .select()
      .from(supplierReturns)
      .where(and(eq(supplierReturns.orgId, orgId), eq(supplierReturns.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const doc = rows[0] as SupplierReturn | undefined;
    if (!doc) return null;

    const lines = (await this.db
      .select()
      .from(supplierReturnLines)
      .where(
        and(
          eq(supplierReturnLines.orgId, orgId),
          eq(supplierReturnLines.supplierReturnId, id),
        ),
      )) as SupplierReturnLine[];
    const serialNumbers = await this.serialsByLine(
      orgId,
      lines.map(({ id: lineId }) => lineId),
    );
    return {
      ...doc,
      lines: lines.map((line) => ({
        ...line,
        serialNumbers: serialNumbers.get(line.id) ?? [],
      })),
    };
  }

  create(
    orgId: string,
    input: CreateSupplierReturnInput,
  ): Promise<SupplierReturnWithLines> {
    return this.inTransaction(async (client) => {
      const [doc] = await client
        .insert(supplierReturns)
        .values({
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          supplierId: input.supplierId,
          goodsReceiptId: input.goodsReceiptId ?? null,
          documentNumber: input.documentNumber ?? null,
          externalSystem: input.externalSystem ?? null,
          externalId: input.externalId ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, doc.id, input.lines);
      return new DrizzleSupplierReturnRepository(client).findById(
        orgId,
        doc.id,
      ) as Promise<SupplierReturnWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateSupplierReturnInput,
  ): Promise<SupplierReturnWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(supplierReturns)
        .set({
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
          ...(input.locationId !== undefined
            ? { locationId: input.locationId }
            : {}),
          ...(input.supplierId !== undefined
            ? { supplierId: input.supplierId }
            : {}),
          ...(input.goodsReceiptId !== undefined
            ? { goodsReceiptId: input.goodsReceiptId }
            : {}),
          ...(input.documentNumber !== undefined
            ? { documentNumber: input.documentNumber }
            : {}),
          ...(input.externalSystem !== undefined
            ? { externalSystem: input.externalSystem }
            : {}),
          ...(input.externalId !== undefined
            ? { externalId: input.externalId }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(supplierReturns.orgId, orgId), eq(supplierReturns.id, id)))
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await this.replaceLines(client, orgId, id, input.lines);
      }
      return new DrizzleSupplierReturnRepository(client).findById(
        orgId,
        id,
      ) as Promise<SupplierReturnWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: SupplierReturn["status"],
    occurredAt: Date,
  ): Promise<SupplierReturn> {
    const [doc] = await this.db
      .update(supplierReturns)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(supplierReturns.orgId, orgId), eq(supplierReturns.id, id)))
      .returning();
    if (!doc) throw new Error("Supplier return not found");
    return doc as SupplierReturn;
  }

  private async serialsByLine(orgId: string, lineIds: string[]) {
    const result = new Map<string, string[]>();
    if (!lineIds.length) return result;
    const rows = await this.db
      .select()
      .from(supplierReturnSerials)
      .where(
        and(
          eq(supplierReturnSerials.orgId, orgId),
          inArray(supplierReturnSerials.supplierReturnLineId, lineIds),
        ),
      );
    for (const row of rows) {
      const values = result.get(row.supplierReturnLineId) ?? [];
      values.push(row.serialNumber);
      result.set(row.supplierReturnLineId, values);
    }
    return result;
  }

  private async replaceLines(
    client: DbClient,
    orgId: string,
    returnId: string,
    lines: LineInput[],
  ): Promise<void> {
    const existing = await client
      .select({ id: supplierReturnLines.id })
      .from(supplierReturnLines)
      .where(
        and(
          eq(supplierReturnLines.orgId, orgId),
          eq(supplierReturnLines.supplierReturnId, returnId),
        ),
      );
    const lineIds = existing.map(({ id }) => id);
    if (lineIds.length) {
      await client
        .delete(supplierReturnSerials)
        .where(
          and(
            eq(supplierReturnSerials.orgId, orgId),
            inArray(supplierReturnSerials.supplierReturnLineId, lineIds),
          ),
        );
    }
    await client
      .delete(supplierReturnLines)
      .where(
        and(
          eq(supplierReturnLines.orgId, orgId),
          eq(supplierReturnLines.supplierReturnId, returnId),
        ),
      );
    await this.insertLines(client, orgId, returnId, lines);
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    returnId: string,
    lines: LineInput[],
  ): Promise<void> {
    for (const input of lines) {
      const [line] = await client
        .insert(supplierReturnLines)
        .values({
          id: input.id,
          orgId,
          supplierReturnId: returnId,
          productId: input.productId,
          qty: input.qty,
          lotId: input.lotId ?? null,
          goodsReceiptLineId: input.goodsReceiptLineId ?? null,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(supplierReturnSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            supplierReturnLineId: line.id,
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
