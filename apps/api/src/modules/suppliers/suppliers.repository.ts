import { and, eq } from "drizzle-orm";
import type { CreateSupplier, UpdateSupplier } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { suppliers } from "../../db/schema/index.js";

export class SupplierRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string) {
    return this.db.select().from(suppliers).where(eq(suppliers.orgId, orgId));
  }

  findById(orgId: string, id: string) {
    return this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.orgId, orgId), eq(suppliers.id, id)))
      .then((rows) => rows[0] ?? null);
  }

  async create(orgId: string, input: CreateSupplier) {
    const [row] = await this.db
      .insert(suppliers)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  }

  async update(orgId: string, id: string, input: UpdateSupplier) {
    const [row] = await this.db
      .update(suppliers)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(suppliers.orgId, orgId), eq(suppliers.id, id)))
      .returning();
    return row ?? null;
  }
}
