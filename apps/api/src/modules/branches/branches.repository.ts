import { and, eq } from "drizzle-orm";
import type { CreateBranch, UpdateBranch } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { branches } from "../../db/schema/index.js";

export class BranchRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string) {
    return this.db.select().from(branches).where(eq(branches.orgId, orgId));
  }

  findById(orgId: string, id: string) {
    return this.db
      .select()
      .from(branches)
      .where(and(eq(branches.orgId, orgId), eq(branches.id, id)))
      .then((rows) => rows[0] ?? null);
  }

  async create(orgId: string, input: CreateBranch) {
    const [row] = await this.db
      .insert(branches)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  }

  async update(orgId: string, id: string, input: UpdateBranch) {
    const [row] = await this.db
      .update(branches)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(branches.orgId, orgId), eq(branches.id, id)))
      .returning();
    return row ?? null;
  }
}
