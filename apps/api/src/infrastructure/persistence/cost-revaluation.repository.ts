import { and, eq } from "drizzle-orm";
import type {
  CostRevaluation,
  CostRevaluationLine,
  CostRevaluationPort,
  CreateCostRevaluationInput,
  UpdateCostRevaluationInput,
} from "@stock-management/application";
import type { DocumentStatus } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  costRevaluationLines,
  costRevaluations,
} from "../db/schema/index.js";

export class DrizzleCostRevaluationRepository implements CostRevaluationPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  async list(orgId: string): Promise<CostRevaluation[]> {
    const headers = await this.db
      .select()
      .from(costRevaluations)
      .where(eq(costRevaluations.orgId, orgId));
    const result: CostRevaluation[] = [];
    for (const header of headers) {
      result.push(await this.hydrate(header));
    }
    return result;
  }

  async findById(orgId: string, id: string): Promise<CostRevaluation | null> {
    const query = this.db
      .select()
      .from(costRevaluations)
      .where(
        and(eq(costRevaluations.orgId, orgId), eq(costRevaluations.id, id)),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const header = rows[0];
    if (!header) return null;
    return this.hydrate(header);
  }

  async create(
    orgId: string,
    input: CreateCostRevaluationInput,
  ): Promise<CostRevaluation> {
    const [header] = await this.db
      .insert(costRevaluations)
      .values({
        orgId,
        branchId: input.branchId,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote ?? null,
        status: "draft",
      })
      .returning();
    const lines = await this.replaceLines(orgId, header!.id, input.lines);
    return this.toDoc(header!, lines);
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateCostRevaluationInput,
  ): Promise<CostRevaluation> {
    const [header] = await this.db
      .update(costRevaluations)
      .set({
        ...(input.reasonCode !== undefined
          ? { reasonCode: input.reasonCode }
          : {}),
        ...(input.reasonNote !== undefined
          ? { reasonNote: input.reasonNote }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(costRevaluations.orgId, orgId), eq(costRevaluations.id, id)),
      )
      .returning();
    if (!header) throw new Error("Cost revaluation not found");
    const lines = input.lines
      ? await this.replaceLines(orgId, id, input.lines)
      : await this.loadLines(orgId, id);
    return this.toDoc(header, lines);
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: DocumentStatus,
    at: Date,
  ): Promise<CostRevaluation> {
    const [header] = await this.db
      .update(costRevaluations)
      .set({
        status,
        postedAt: status === "posted" ? at : undefined,
        voidedAt: status === "void" ? at : undefined,
        updatedAt: at,
      })
      .where(
        and(eq(costRevaluations.orgId, orgId), eq(costRevaluations.id, id)),
      )
      .returning();
    if (!header) throw new Error("Cost revaluation not found");
    return this.hydrate(header);
  }

  private async hydrate(
    header: typeof costRevaluations.$inferSelect,
  ): Promise<CostRevaluation> {
    return this.toDoc(header, await this.loadLines(header.orgId, header.id));
  }

  private async loadLines(
    orgId: string,
    documentId: string,
  ): Promise<CostRevaluationLine[]> {
    const rows = await this.db
      .select()
      .from(costRevaluationLines)
      .where(
        and(
          eq(costRevaluationLines.orgId, orgId),
          eq(costRevaluationLines.costRevaluationId, documentId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      costRevaluationId: row.costRevaluationId,
      lineNumber: row.lineNumber,
      costLayerId: row.costLayerId,
      newUnitCost: row.newUnitCost,
    }));
  }

  private async replaceLines(
    orgId: string,
    documentId: string,
    lines: CreateCostRevaluationInput["lines"],
  ): Promise<CostRevaluationLine[]> {
    await this.db
      .delete(costRevaluationLines)
      .where(
        and(
          eq(costRevaluationLines.orgId, orgId),
          eq(costRevaluationLines.costRevaluationId, documentId),
        ),
      );
    if (lines.length === 0) return [];
    const inserted = await this.db
      .insert(costRevaluationLines)
      .values(
        lines.map((line, index) => ({
          orgId,
          costRevaluationId: documentId,
          lineNumber: index + 1,
          costLayerId: line.costLayerId,
          newUnitCost: line.newUnitCost,
        })),
      )
      .returning();
    return inserted.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      costRevaluationId: row.costRevaluationId,
      lineNumber: row.lineNumber,
      costLayerId: row.costLayerId,
      newUnitCost: row.newUnitCost,
    }));
  }

  private toDoc(
    header: typeof costRevaluations.$inferSelect,
    lines: CostRevaluationLine[],
  ): CostRevaluation {
    return {
      id: header.id,
      orgId: header.orgId,
      branchId: header.branchId,
      reasonCode: header.reasonCode,
      reasonNote: header.reasonNote,
      status: header.status,
      createdAt: header.createdAt,
      updatedAt: header.updatedAt,
      postedAt: header.postedAt,
      voidedAt: header.voidedAt,
      lines,
    };
  }
}
