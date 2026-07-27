import { and, eq, type SQL } from "drizzle-orm";
import type { LotPort, UpsertLotInput } from "@stock-management/application";
import type { Lot } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { lots } from "../db/schema/index.js";

export class DrizzleLotRepository implements LotPort {
  constructor(private readonly db: DbClient) {}

  async upsert(input: UpsertLotInput): Promise<Lot> {
    if (input.lotId) {
      const [existing] = await this.db
        .select()
        .from(lots)
        .where(
          and(
            eq(lots.orgId, input.orgId),
            eq(lots.productId, input.productId),
            eq(lots.id, input.lotId),
          ),
        );
      if (!existing) throw new Error("Lot not found");
      if (input.expiryDate !== undefined) {
        const [updated] = await this.db
          .update(lots)
          .set({ expiryDate: input.expiryDate, updatedAt: new Date() })
          .where(
            and(
              eq(lots.orgId, input.orgId),
              eq(lots.productId, input.productId),
              eq(lots.id, input.lotId),
            ),
          )
          .returning();
        return updated as Lot;
      }
      return existing as Lot;
    }
    if (!input.lotCode) throw new Error("Lot code is required");

    const [lot] = await this.db
      .insert(lots)
      .values({
        orgId: input.orgId,
        productId: input.productId,
        lotCode: input.lotCode,
        expiryDate: input.expiryDate ?? null,
      })
      .onConflictDoUpdate({
        target: [lots.orgId, lots.productId, lots.lotCode],
        set: { expiryDate: input.expiryDate ?? null, updatedAt: new Date() },
      })
      .returning();
    return lot as Lot;
  }

  async findById(orgId: string, id: string): Promise<Lot | null> {
    const [lot] = await this.db
      .select()
      .from(lots)
      .where(and(eq(lots.orgId, orgId), eq(lots.id, id)));
    return (lot as Lot | undefined) ?? null;
  }

  list(orgId: string, filters?: { productId?: string }): Promise<Lot[]> {
    const conditions: SQL[] = [eq(lots.orgId, orgId)];
    if (filters?.productId) conditions.push(eq(lots.productId, filters.productId));
    return this.db
      .select()
      .from(lots)
      .where(and(...conditions)) as Promise<Lot[]>;
  }
}
