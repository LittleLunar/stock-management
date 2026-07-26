import { and, eq, inArray } from "drizzle-orm";
import type {
  CreateCustomerReturnInput,
  CustomerReturnPort,
  CustomerReturnWithLines,
  UpdateCustomerReturnInput,
} from "@stock-management/application";
import type { CustomerReturn, CustomerReturnLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  customerReturnLines,
  customerReturnSerials,
  customerReturns,
} from "../db/schema/index.js";

type LineInput = CreateCustomerReturnInput["lines"][number];

export class DrizzleCustomerReturnRepository implements CustomerReturnPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string): Promise<CustomerReturn[]> {
    return this.db
      .select()
      .from(customerReturns)
      .where(eq(customerReturns.orgId, orgId)) as Promise<CustomerReturn[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<CustomerReturnWithLines | null> {
    const query = this.db
      .select()
      .from(customerReturns)
      .where(and(eq(customerReturns.orgId, orgId), eq(customerReturns.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const doc = rows[0] as CustomerReturn | undefined;
    if (!doc) return null;

    const lines = (await this.db
      .select()
      .from(customerReturnLines)
      .where(
        and(
          eq(customerReturnLines.orgId, orgId),
          eq(customerReturnLines.customerReturnId, id),
        ),
      )) as CustomerReturnLine[];
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
    input: CreateCustomerReturnInput,
  ): Promise<CustomerReturnWithLines> {
    return this.inTransaction(async (client) => {
      const [doc] = await client
        .insert(customerReturns)
        .values({
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          customerId: input.customerId,
          documentNumber: input.documentNumber ?? null,
          externalSystem: input.externalSystem ?? null,
          externalId: input.externalId ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, doc.id, input.lines);
      return new DrizzleCustomerReturnRepository(client).findById(
        orgId,
        doc.id,
      ) as Promise<CustomerReturnWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateCustomerReturnInput,
  ): Promise<CustomerReturnWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(customerReturns)
        .set({
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
          ...(input.locationId !== undefined
            ? { locationId: input.locationId }
            : {}),
          ...(input.customerId !== undefined
            ? { customerId: input.customerId }
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
        .where(and(eq(customerReturns.orgId, orgId), eq(customerReturns.id, id)))
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await this.replaceLines(client, orgId, id, input.lines);
      }
      return new DrizzleCustomerReturnRepository(client).findById(
        orgId,
        id,
      ) as Promise<CustomerReturnWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: CustomerReturn["status"],
    occurredAt: Date,
  ): Promise<CustomerReturn> {
    const [doc] = await this.db
      .update(customerReturns)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(customerReturns.orgId, orgId), eq(customerReturns.id, id)))
      .returning();
    if (!doc) throw new Error("Customer return not found");
    return doc as CustomerReturn;
  }

  private async serialsByLine(orgId: string, lineIds: string[]) {
    const result = new Map<string, string[]>();
    if (!lineIds.length) return result;
    const rows = await this.db
      .select()
      .from(customerReturnSerials)
      .where(
        and(
          eq(customerReturnSerials.orgId, orgId),
          inArray(customerReturnSerials.customerReturnLineId, lineIds),
        ),
      );
    for (const row of rows) {
      const values = result.get(row.customerReturnLineId) ?? [];
      values.push(row.serialNumber);
      result.set(row.customerReturnLineId, values);
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
      .select({ id: customerReturnLines.id })
      .from(customerReturnLines)
      .where(
        and(
          eq(customerReturnLines.orgId, orgId),
          eq(customerReturnLines.customerReturnId, returnId),
        ),
      );
    const lineIds = existing.map(({ id }) => id);
    if (lineIds.length) {
      await client
        .delete(customerReturnSerials)
        .where(
          and(
            eq(customerReturnSerials.orgId, orgId),
            inArray(customerReturnSerials.customerReturnLineId, lineIds),
          ),
        );
    }
    await client
      .delete(customerReturnLines)
      .where(
        and(
          eq(customerReturnLines.orgId, orgId),
          eq(customerReturnLines.customerReturnId, returnId),
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
        .insert(customerReturnLines)
        .values({
          id: input.id,
          orgId,
          customerReturnId: returnId,
          productId: input.productId,
          qty: input.qty,
          lotId: input.lotId ?? null,
          unitCost: input.unitCost ?? null,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(customerReturnSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            customerReturnLineId: line.id,
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
