import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type {
  CreateStockMovementInput,
  StockBalanceKey,
  StockPort,
} from "@stock-management/application";
import type { StockBalance, StockMovement } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { products, stockBalances, stockMovements } from "../db/schema/index.js";

export class DrizzleStockRepository implements StockPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  async findBalance(key: StockBalanceKey): Promise<StockBalance | null> {
    if (this.lockForUpdate) {
      // Materialize a zero row before locking so concurrent first receipts for the
      // same nullable-lot key cannot both calculate from an absent balance.
      await this.db
        .insert(stockBalances)
        .values({ ...key, qtyOnHand: "0" })
        .onConflictDoNothing();
    }
    const query = this.db
      .select()
      .from(stockBalances)
      .where(this.balanceWhere(key));
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    return (rows[0] as StockBalance | undefined) ?? null;
  }

  async setBalance(
    key: StockBalanceKey,
    qtyOnHand: string,
  ): Promise<StockBalance> {
    const [inserted] = await this.db
      .insert(stockBalances)
      .values({ ...key, qtyOnHand })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted as StockBalance;

    const [updated] = await this.db
      .update(stockBalances)
      .set({ qtyOnHand, updatedAt: new Date() })
      .where(this.balanceWhere(key))
      .returning();
    if (!updated) throw new Error("Stock balance not found after conflict");
    return updated as StockBalance;
  }

  async setQtyReserved(
    key: StockBalanceKey,
    qtyReserved: string,
  ): Promise<StockBalance> {
    const [inserted] = await this.db
      .insert(stockBalances)
      .values({ ...key, qtyOnHand: "0", qtyReserved })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted as StockBalance;

    const [updated] = await this.db
      .update(stockBalances)
      .set({ qtyReserved, updatedAt: new Date() })
      .where(this.balanceWhere(key))
      .returning();
    if (!updated) throw new Error("Stock balance not found after conflict");
    return updated as StockBalance;
  }

  async insertMovement(input: CreateStockMovementInput): Promise<StockMovement> {
    const [movement] = await this.db
      .insert(stockMovements)
      .values({
        orgId: input.orgId,
        productId: input.productId,
        locationId: input.locationId,
        lotId: input.lotId,
        documentType: input.documentType,
        documentId: input.documentId,
        documentLineId: input.documentLineId,
        movementType: input.movementType,
        qty: input.qty,
        unitCost: input.unitCost ?? null,
        totalCost: input.totalCost ?? null,
        createdAt: input.createdAt,
      })
      .returning();
    return {
      ...(movement as StockMovement),
      unitCost: (movement.unitCost as string | null) ?? null,
      totalCost: (movement.totalCost as string | null) ?? null,
    };
  }

  async updateMovementCosts(
    orgId: string,
    movementId: string,
    unitCost: string,
    totalCost: string,
  ): Promise<StockMovement> {
    const [movement] = await this.db
      .update(stockMovements)
      .set({ unitCost, totalCost })
      .where(
        and(
          eq(stockMovements.orgId, orgId),
          eq(stockMovements.id, movementId),
        ),
      )
      .returning();
    if (!movement) throw new Error("Stock movement not found");
    return {
      ...(movement as StockMovement),
      unitCost: (movement.unitCost as string | null) ?? null,
      totalCost: (movement.totalCost as string | null) ?? null,
    };
  }

  async listBalances(
    orgId: string,
    filters?: { productId?: string; locationId?: string; lowStock?: boolean },
  ): Promise<StockBalance[]> {
    const conditions: SQL[] = [eq(stockBalances.orgId, orgId)];
    if (filters?.productId) {
      conditions.push(eq(stockBalances.productId, filters.productId));
    }
    if (filters?.locationId) {
      conditions.push(eq(stockBalances.locationId, filters.locationId));
    }
    if (filters?.lowStock) {
      conditions.push(
        sql`${products.reorderMin} is not null and ${stockBalances.qtyOnHand} <= ${products.reorderMin}`,
      );
    }

    return this.db
      .select({
        id: stockBalances.id,
        orgId: stockBalances.orgId,
        productId: stockBalances.productId,
        locationId: stockBalances.locationId,
        lotId: stockBalances.lotId,
        qtyOnHand: stockBalances.qtyOnHand,
        qtyReserved: stockBalances.qtyReserved,
        updatedAt: stockBalances.updatedAt,
      })
      .from(stockBalances)
      .innerJoin(
        products,
        and(
          eq(products.orgId, orgId),
          eq(products.id, stockBalances.productId),
        ),
      )
      .where(and(...conditions)) as Promise<StockBalance[]>;
  }

  async listMovements(
    orgId: string,
    filters?: {
      productId?: string;
      locationId?: string;
      documentType?: string;
      documentId?: string;
    },
  ): Promise<StockMovement[]> {
    const conditions: SQL[] = [eq(stockMovements.orgId, orgId)];
    if (filters?.productId) {
      conditions.push(eq(stockMovements.productId, filters.productId));
    }
    if (filters?.locationId) {
      conditions.push(eq(stockMovements.locationId, filters.locationId));
    }
    if (filters?.documentType) {
      conditions.push(eq(stockMovements.documentType, filters.documentType));
    }
    if (filters?.documentId) {
      conditions.push(eq(stockMovements.documentId, filters.documentId));
    }
    return this.db
      .select()
      .from(stockMovements)
      .where(and(...conditions)) as Promise<StockMovement[]>;
  }

  private balanceWhere(key: StockBalanceKey): SQL {
    return and(
      eq(stockBalances.orgId, key.orgId),
      eq(stockBalances.productId, key.productId),
      eq(stockBalances.locationId, key.locationId),
      key.lotId === null
        ? isNull(stockBalances.lotId)
        : eq(stockBalances.lotId, key.lotId),
    )!;
  }
}
