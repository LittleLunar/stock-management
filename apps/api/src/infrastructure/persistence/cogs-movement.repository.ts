import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  CogsFilter,
  CogsMovementSource,
  CogsSourceRow,
} from "@stock-management/application";
import type { DbClient } from "../db/client.js";
import {
  locations,
  stockAdjustments,
  stockCounts,
  stockIssues,
  stockMovements,
  supplierReturns,
} from "../db/schema/index.js";

const COGS_MOVEMENT_TYPES = [
  "issue",
  "supplier_return",
  "adjustment",
  "count_variance",
] as const;

export class DrizzleCogsMovementSource implements CogsMovementSource {
  constructor(private readonly db: DbClient) {}

  async listOutboundMovements(
    orgId: string,
    filter: CogsFilter,
  ): Promise<CogsSourceRow[]> {
    const rows = await this.db
      .select({
        movementType: stockMovements.movementType,
        documentType: stockMovements.documentType,
        documentId: stockMovements.documentId,
        totalCost: stockMovements.totalCost,
        createdAt: stockMovements.createdAt,
        branchId: locations.branchId,
        qty: stockMovements.qty,
      })
      .from(stockMovements)
      .innerJoin(
        locations,
        and(
          eq(locations.id, stockMovements.locationId),
          eq(locations.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(stockMovements.orgId, orgId),
          inArray(stockMovements.movementType, [...COGS_MOVEMENT_TYPES]),
          gte(stockMovements.createdAt, filter.from),
          lte(stockMovements.createdAt, filter.to),
          filter.branchId ? eq(locations.branchId, filter.branchId) : undefined,
          sql`(${stockMovements.qty})::numeric < 0 OR ${stockMovements.movementType} IN ('issue', 'supplier_return')`,
        ),
      );

    const result: CogsSourceRow[] = [];
    for (const row of rows) {
      const status = await this.documentStatus(
        orgId,
        row.documentType,
        row.documentId,
      );
      result.push({
        branchId: row.branchId,
        movementType: row.movementType,
        documentType: row.documentType,
        totalCost: row.totalCost ?? "0",
        createdAt: row.createdAt,
        documentStatus: status,
      });
    }
    return result;
  }

  private async documentStatus(
    orgId: string,
    documentType: string,
    documentId: string,
  ): Promise<string> {
    if (documentType === "stock_issue") {
      const [row] = await this.db
        .select({ status: stockIssues.status })
        .from(stockIssues)
        .where(
          and(eq(stockIssues.orgId, orgId), eq(stockIssues.id, documentId)),
        )
        .limit(1);
      return row?.status ?? "void";
    }
    if (documentType === "supplier_return") {
      const [row] = await this.db
        .select({ status: supplierReturns.status })
        .from(supplierReturns)
        .where(
          and(
            eq(supplierReturns.orgId, orgId),
            eq(supplierReturns.id, documentId),
          ),
        )
        .limit(1);
      return row?.status ?? "void";
    }
    if (documentType === "stock_adjustment") {
      const [row] = await this.db
        .select({ status: stockAdjustments.status })
        .from(stockAdjustments)
        .where(
          and(
            eq(stockAdjustments.orgId, orgId),
            eq(stockAdjustments.id, documentId),
          ),
        )
        .limit(1);
      return row?.status ?? "void";
    }
    if (documentType === "stock_count") {
      const [row] = await this.db
        .select({ status: stockCounts.status })
        .from(stockCounts)
        .where(
          and(eq(stockCounts.orgId, orgId), eq(stockCounts.id, documentId)),
        )
        .limit(1);
      return row?.status ?? "void";
    }
    return "void";
  }
}
