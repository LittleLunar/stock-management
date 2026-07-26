import { and, eq } from "drizzle-orm";
import type {
  CreateSupplierInput,
  SupplierRepository,
  UpdateSupplierInput,
} from "@stock-management/application";
import type { Supplier } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { suppliers } from "../db/schema/index.js";

export class DrizzleSupplierRepository implements SupplierRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<Supplier[]> {
    return this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.orgId, orgId)) as Promise<Supplier[]>;
  }

  findById(orgId: string, id: string): Promise<Supplier | null> {
    return this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.orgId, orgId), eq(suppliers.id, id)))
      .then((rows) => (rows[0] as Supplier | undefined) ?? null);
  }

  async create(orgId: string, input: CreateSupplierInput): Promise<Supplier> {
    const [row] = await this.db
      .insert(suppliers)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row as Supplier;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier | null> {
    const [row] = await this.db
      .update(suppliers)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(suppliers.orgId, orgId), eq(suppliers.id, id)))
      .returning();
    return (row as Supplier | undefined) ?? null;
  }
}
