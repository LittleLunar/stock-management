import { eq } from "drizzle-orm";
import type { UpdateOrganization } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { organizations } from "../../db/schema/index.js";

export class OrgRepository {
  constructor(private readonly db: Db) {}

  findById(id: string) {
    return this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async update(id: string, input: UpdateOrganization) {
    const [row] = await this.db
      .update(organizations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();
    return row ?? null;
  }

  async create(input: {
    name: string;
    currency?: string;
    timezone?: string;
    fiscalYearStartMonth?: number;
  }) {
    const [row] = await this.db
      .insert(organizations)
      .values({
        name: input.name,
        currency: input.currency ?? "THB",
        timezone: input.timezone ?? "Asia/Bangkok",
        fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
      })
      .returning();
    return row;
  }
}
