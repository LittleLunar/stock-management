import { and, eq } from "drizzle-orm";
import type { CreateLocation, UpdateLocation } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { locations } from "../../db/schema/index.js";

export class LocationRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string, branchId?: string) {
    if (branchId) {
      return this.db
        .select()
        .from(locations)
        .where(and(eq(locations.orgId, orgId), eq(locations.branchId, branchId)));
    }
    return this.db.select().from(locations).where(eq(locations.orgId, orgId));
  }

  findById(orgId: string, id: string) {
    return this.db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, orgId), eq(locations.id, id)))
      .then((rows) => rows[0] ?? null);
  }

  async create(orgId: string, input: CreateLocation) {
    const [row] = await this.db
      .insert(locations)
      .values({
        orgId,
        branchId: input.branchId,
        code: input.code,
        name: input.name,
        type: input.type ?? "storage",
        status: input.status ?? "active",
      })
      .returning();
    return row;
  }

  async update(orgId: string, id: string, input: UpdateLocation) {
    const [row] = await this.db
      .update(locations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(locations.orgId, orgId), eq(locations.id, id)))
      .returning();
    return row ?? null;
  }
}
