import { and, eq } from "drizzle-orm";
import type {
  BranchListFilter,
  CreateLandedCostInput,
  LandedCostDocument,
  LandedCostLine,
  LandedCostPort,
  UpdateLandedCostInput,
} from "@stock-management/application";
import type { DocumentStatus } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { landedCostDocuments, landedCostLines } from "../db/schema/index.js";

export class DrizzleLandedCostRepository implements LandedCostPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  async list(
    orgId: string,
    filter?: BranchListFilter,
  ): Promise<LandedCostDocument[]> {
    const conditions = [eq(landedCostDocuments.orgId, orgId)];
    if (filter?.kind === "branch") {
      conditions.push(eq(landedCostDocuments.branchId, filter.branchId));
    }
    const headers = await this.db
      .select()
      .from(landedCostDocuments)
      .where(and(...conditions));
    const result: LandedCostDocument[] = [];
    for (const header of headers) {
      result.push(await this.hydrate(header as typeof headers[number]));
    }
    return result;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<LandedCostDocument | null> {
    const query = this.db
      .select()
      .from(landedCostDocuments)
      .where(
        and(
          eq(landedCostDocuments.orgId, orgId),
          eq(landedCostDocuments.id, id),
        ),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const header = rows[0];
    if (!header) return null;
    return this.hydrate(header);
  }

  async create(
    orgId: string,
    input: CreateLandedCostInput,
  ): Promise<LandedCostDocument> {
    const [header] = await this.db
      .insert(landedCostDocuments)
      .values({
        orgId,
        branchId: input.branchId,
        supplierId: input.supplierId ?? null,
        costType: input.costType,
        totalAmount: input.totalAmount,
        status: "draft",
      })
      .returning();
    const lines = await this.replaceLines(orgId, header!.id, input.lines);
    return this.toDoc(header!, lines);
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateLandedCostInput,
  ): Promise<LandedCostDocument> {
    const [header] = await this.db
      .update(landedCostDocuments)
      .set({
        ...(input.supplierId !== undefined
          ? { supplierId: input.supplierId }
          : {}),
        ...(input.costType !== undefined ? { costType: input.costType } : {}),
        ...(input.totalAmount !== undefined
          ? { totalAmount: input.totalAmount }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(landedCostDocuments.orgId, orgId),
          eq(landedCostDocuments.id, id),
        ),
      )
      .returning();
    if (!header) throw new Error("Landed cost not found");
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
  ): Promise<LandedCostDocument> {
    const [header] = await this.db
      .update(landedCostDocuments)
      .set({
        status,
        postedAt: status === "posted" ? at : undefined,
        voidedAt: status === "void" ? at : undefined,
        updatedAt: at,
      })
      .where(
        and(
          eq(landedCostDocuments.orgId, orgId),
          eq(landedCostDocuments.id, id),
        ),
      )
      .returning();
    if (!header) throw new Error("Landed cost not found");
    return this.hydrate(header);
  }

  private async hydrate(
    header: typeof landedCostDocuments.$inferSelect,
  ): Promise<LandedCostDocument> {
    const lines = await this.loadLines(header.orgId, header.id);
    return this.toDoc(header, lines);
  }

  private async loadLines(
    orgId: string,
    documentId: string,
  ): Promise<LandedCostLine[]> {
    const rows = await this.db
      .select()
      .from(landedCostLines)
      .where(
        and(
          eq(landedCostLines.orgId, orgId),
          eq(landedCostLines.landedCostDocumentId, documentId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      landedCostDocumentId: row.landedCostDocumentId,
      lineNumber: row.lineNumber,
      goodsReceiptLineId: row.goodsReceiptLineId,
      costLayerId: row.costLayerId,
      amount: row.amount,
    }));
  }

  private async replaceLines(
    orgId: string,
    documentId: string,
    lines: CreateLandedCostInput["lines"],
  ): Promise<LandedCostLine[]> {
    await this.db
      .delete(landedCostLines)
      .where(
        and(
          eq(landedCostLines.orgId, orgId),
          eq(landedCostLines.landedCostDocumentId, documentId),
        ),
      );
    if (lines.length === 0) return [];
    const inserted = await this.db
      .insert(landedCostLines)
      .values(
        lines.map((line, index) => ({
          orgId,
          landedCostDocumentId: documentId,
          lineNumber: index + 1,
          goodsReceiptLineId: line.goodsReceiptLineId ?? null,
          costLayerId: line.costLayerId ?? null,
          amount: line.amount,
        })),
      )
      .returning();
    return inserted.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      landedCostDocumentId: row.landedCostDocumentId,
      lineNumber: row.lineNumber,
      goodsReceiptLineId: row.goodsReceiptLineId,
      costLayerId: row.costLayerId,
      amount: row.amount,
    }));
  }

  private toDoc(
    header: typeof landedCostDocuments.$inferSelect,
    lines: LandedCostLine[],
  ): LandedCostDocument {
    return {
      id: header.id,
      orgId: header.orgId,
      branchId: header.branchId,
      supplierId: header.supplierId,
      costType: header.costType,
      totalAmount: header.totalAmount,
      status: header.status,
      createdAt: header.createdAt,
      updatedAt: header.updatedAt,
      postedAt: header.postedAt,
      voidedAt: header.voidedAt,
      lines,
    };
  }
}
