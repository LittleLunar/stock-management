import { eq } from "drizzle-orm";
import type {
  CreateOrganizationInput,
  OrganizationOwnerInput,
  OrganizationRepository,
  UpdateOrganizationInput,
} from "@stock-management/application";
import type { Organization } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { memberships, organizations, users } from "../db/schema/index.js";

export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): Promise<Organization | null> {
    return this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .then((rows) => (rows[0] as Organization | undefined) ?? null);
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization | null> {
    const [row] = await this.db
      .update(organizations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();
    return (row as Organization | undefined) ?? null;
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const [row] = await this.db
      .insert(organizations)
      .values({
        name: input.name,
        currency: input.currency ?? "THB",
        timezone: input.timezone ?? "Asia/Bangkok",
        fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
      })
      .returning();
    return row as Organization;
  }

  async createWithOwner(
    input: CreateOrganizationInput,
    owner: OrganizationOwnerInput,
  ): Promise<Organization> {
    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.name,
          currency: input.currency ?? "THB",
          timezone: input.timezone ?? "Asia/Bangkok",
          fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
        })
        .returning();

      await tx.insert(users).values({
        id: owner.userId,
        orgId: org.id,
        email: owner.email,
        name: owner.name,
        status: "active",
      });

      await tx.insert(memberships).values({
        orgId: org.id,
        userId: owner.userId,
        role: "org_admin",
        status: "active",
      });

      return org as Organization;
    });
  }
}
