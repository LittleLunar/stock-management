import { and, eq } from "drizzle-orm";
import type {
  CreateCustomerInput,
  CustomerRepository,
} from "@stock-management/application";
import type { Customer } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { customers } from "../db/schema/index.js";

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<Customer[]> {
    return this.db
      .select()
      .from(customers)
      .where(eq(customers.orgId, orgId)) as Promise<Customer[]>;
  }

  findById(orgId: string, id: string): Promise<Customer | null> {
    return this.db
      .select()
      .from(customers)
      .where(and(eq(customers.orgId, orgId), eq(customers.id, id)))
      .then((rows) => (rows[0] as Customer | undefined) ?? null);
  }

  async create(orgId: string, input: CreateCustomerInput): Promise<Customer> {
    const [row] = await this.db
      .insert(customers)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row as Customer;
  }
}
