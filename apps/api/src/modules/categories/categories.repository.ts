import { and, eq } from "drizzle-orm";
import type { CreateCategory, UpdateCategory } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { categories } from "../../db/schema/index.js";

export class CategoryRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string) {
    return this.db.select().from(categories).where(eq(categories.orgId, orgId));
  }

  findById(orgId: string, id: string) {
    return this.db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .then((rows) => rows[0] ?? null);
  }

  async create(orgId: string, input: CreateCategory) {
    const [row] = await this.db
      .insert(categories)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  }

  async update(orgId: string, id: string, input: UpdateCategory) {
    const [row] = await this.db
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .returning();
    return row ?? null;
  }
}
