import { and, eq, inArray } from "drizzle-orm";
import type {
  CreateStockIssueInput,
  StockIssuePort,
  StockIssueWithLines,
  UpdateStockIssueInput,
} from "@stock-management/application";
import type { StockIssue, StockIssueLine } from "@stock-management/domain";
import type { Db, DbClient, DbTransaction } from "../db/client.js";
import {
  stockIssueLines,
  stockIssueSerials,
  stockIssues,
} from "../db/schema/index.js";

type LineInput = CreateStockIssueInput["lines"][number];

export class DrizzleStockIssueRepository implements StockIssuePort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(orgId: string): Promise<StockIssue[]> {
    return this.db
      .select()
      .from(stockIssues)
      .where(eq(stockIssues.orgId, orgId)) as Promise<StockIssue[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<StockIssueWithLines | null> {
    const query = this.db
      .select()
      .from(stockIssues)
      .where(and(eq(stockIssues.orgId, orgId), eq(stockIssues.id, id)));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const issue = rows[0] as StockIssue | undefined;
    if (!issue) return null;

    const lines = (await this.db
      .select()
      .from(stockIssueLines)
      .where(
        and(
          eq(stockIssueLines.orgId, orgId),
          eq(stockIssueLines.stockIssueId, id),
        ),
      )) as StockIssueLine[];
    const serialNumbers = await this.serialsByLine(
      orgId,
      lines.map(({ id }) => id),
    );
    return {
      ...issue,
      lines: lines.map((line) => ({
        ...line,
        serialNumbers: serialNumbers.get(line.id) ?? [],
      })),
    };
  }

  create(
    orgId: string,
    input: CreateStockIssueInput,
  ): Promise<StockIssueWithLines> {
    return this.inTransaction(async (client) => {
      const [issue] = await client
        .insert(stockIssues)
        .values({
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber ?? null,
          issueType: input.issueType,
          reasonNote: input.reasonNote ?? null,
        })
        .returning();
      await this.insertLines(client, orgId, issue.id, input.lines);
      return new DrizzleStockIssueRepository(client).findById(
        orgId,
        issue.id,
      ) as Promise<StockIssueWithLines>;
    });
  }

  update(
    orgId: string,
    id: string,
    input: UpdateStockIssueInput,
  ): Promise<StockIssueWithLines | null> {
    return this.inTransaction(async (client) => {
      const [updated] = await client
        .update(stockIssues)
        .set({
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber,
          issueType: input.issueType,
          reasonNote: input.reasonNote,
          updatedAt: new Date(),
        })
        .where(and(eq(stockIssues.orgId, orgId), eq(stockIssues.id, id)))
        .returning();
      if (!updated) return null;
      if (input.lines) {
        await this.replaceLines(client, orgId, id, input.lines);
      }
      return new DrizzleStockIssueRepository(client).findById(
        orgId,
        id,
      ) as Promise<StockIssueWithLines>;
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: StockIssue["status"],
    occurredAt: Date,
  ): Promise<StockIssue> {
    const [issue] = await this.db
      .update(stockIssues)
      .set({
        status,
        postedAt: status === "posted" ? occurredAt : undefined,
        voidedAt: status === "void" ? occurredAt : undefined,
        updatedAt: occurredAt,
      })
      .where(and(eq(stockIssues.orgId, orgId), eq(stockIssues.id, id)))
      .returning();
    if (!issue) throw new Error("Stock issue not found");
    return issue as StockIssue;
  }

  private async serialsByLine(orgId: string, lineIds: string[]) {
    const result = new Map<string, string[]>();
    if (!lineIds.length) return result;
    const rows = await this.db
      .select()
      .from(stockIssueSerials)
      .where(
        and(
          eq(stockIssueSerials.orgId, orgId),
          inArray(stockIssueSerials.stockIssueLineId, lineIds),
        ),
      );
    for (const row of rows) {
      const values = result.get(row.stockIssueLineId) ?? [];
      values.push(row.serialNumber);
      result.set(row.stockIssueLineId, values);
    }
    return result;
  }

  private async replaceLines(
    client: DbClient,
    orgId: string,
    issueId: string,
    lines: LineInput[],
  ): Promise<void> {
    const existing = await client
      .select({ id: stockIssueLines.id })
      .from(stockIssueLines)
      .where(
        and(
          eq(stockIssueLines.orgId, orgId),
          eq(stockIssueLines.stockIssueId, issueId),
        ),
      );
    const lineIds = existing.map(({ id }) => id);
    if (lineIds.length) {
      await client
        .delete(stockIssueSerials)
        .where(
          and(
            eq(stockIssueSerials.orgId, orgId),
            inArray(stockIssueSerials.stockIssueLineId, lineIds),
          ),
        );
    }
    await client
      .delete(stockIssueLines)
      .where(
        and(
          eq(stockIssueLines.orgId, orgId),
          eq(stockIssueLines.stockIssueId, issueId),
        ),
      );
    await this.insertLines(client, orgId, issueId, lines);
  }

  private async insertLines(
    client: DbClient,
    orgId: string,
    issueId: string,
    lines: LineInput[],
  ): Promise<void> {
    for (const input of lines) {
      const [line] = await client
        .insert(stockIssueLines)
        .values({
          id: input.id,
          orgId,
          stockIssueId: issueId,
          productId: input.productId,
          qty: input.qty,
          lotId: input.lotId ?? null,
          lineNumber: input.lineNumber,
        })
        .returning();
      if (input.serialNumbers?.length) {
        await client.insert(stockIssueSerials).values(
          input.serialNumbers.map((serialNumber) => ({
            orgId,
            stockIssueLineId: line.id,
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
