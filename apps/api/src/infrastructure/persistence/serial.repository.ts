import { and, eq, type SQL } from "drizzle-orm";
import type {
  SerialPort,
  UpsertSerialInput,
} from "@stock-management/application";
import type { Serial } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { lots, serials } from "../db/schema/index.js";

export class DrizzleSerialRepository implements SerialPort {
  constructor(private readonly db: DbClient) {}

  async upsert(input: UpsertSerialInput): Promise<Serial> {
    if (input.lotId) {
      const [lot] = await this.db
        .select({ id: lots.id })
        .from(lots)
        .where(
          and(
            eq(lots.orgId, input.orgId),
            eq(lots.productId, input.productId),
            eq(lots.id, input.lotId),
          ),
        );
      if (!lot) throw new Error("Lot not found");
    }

    const [serial] = await this.db
      .insert(serials)
      .values({
        orgId: input.orgId,
        productId: input.productId,
        lotId: input.lotId,
        locationId: input.locationId ?? null,
        serialNumber: input.serialNumber,
      })
      .onConflictDoUpdate({
        target: [serials.orgId, serials.productId, serials.serialNumber],
        set: {
          lotId: input.lotId,
          locationId: input.locationId ?? null,
          status: "in_stock",
          updatedAt: new Date(),
        },
      })
      .returning();
    return serial as Serial;
  }

  findByNumber(
    orgId: string,
    productId: string,
    serialNumber: string,
  ): Promise<Serial | null> {
    return this.db
      .select()
      .from(serials)
      .where(
        and(
          eq(serials.orgId, orgId),
          eq(serials.productId, productId),
          eq(serials.serialNumber, serialNumber),
        ),
      )
      .then((rows) => (rows[0] as Serial | undefined) ?? null);
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: Serial["status"],
  ): Promise<Serial> {
    const [serial] = await this.db
      .update(serials)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(serials.orgId, orgId), eq(serials.id, id)))
      .returning();
    if (!serial) throw new Error("Serial not found");
    return serial as Serial;
  }

  async updateLocation(
    orgId: string,
    id: string,
    locationId: string | null,
  ): Promise<Serial> {
    const [serial] = await this.db
      .update(serials)
      .set({ locationId, updatedAt: new Date() })
      .where(and(eq(serials.orgId, orgId), eq(serials.id, id)))
      .returning();
    if (!serial) throw new Error("Serial not found");
    return serial as Serial;
  }

  list(orgId: string, filters?: { productId?: string }): Promise<Serial[]> {
    const conditions: SQL[] = [eq(serials.orgId, orgId)];
    if (filters?.productId) {
      conditions.push(eq(serials.productId, filters.productId));
    }
    return this.db
      .select()
      .from(serials)
      .where(and(...conditions)) as Promise<Serial[]>;
  }
}
