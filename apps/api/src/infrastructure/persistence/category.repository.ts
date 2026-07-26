import { and, eq } from "drizzle-orm";
import type {
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@stock-management/application";
import type { Category } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { categories } from "../db/schema/index.js";

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.orgId, orgId)) as Promise<Category[]>;
  }

  findById(orgId: string, id: string): Promise<Category | null> {
    return this.db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .then((rows) => (rows[0] as Category | undefined) ?? null);
  }

  async create(orgId: string, input: CreateCategoryInput): Promise<Category> {
    const [row] = await this.db
      .insert(categories)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row as Category;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category | null> {
    const [row] = await this.db
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .returning();
    return (row as Category | undefined) ?? null;
  }
}
