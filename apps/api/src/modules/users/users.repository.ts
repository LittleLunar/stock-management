import { and, eq } from "drizzle-orm";
import type { CreateMembership, CreateUser } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { membershipBranches, memberships, users } from "../../db/schema/index.js";

export class UsersRepository {
  constructor(private readonly db: Db) {}

  listUsers(orgId: string) {
    return this.db.select().from(users).where(eq(users.orgId, orgId));
  }

  async createUser(orgId: string, input: CreateUser) {
    const [row] = await this.db
      .insert(users)
      .values({
        orgId,
        email: input.email,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  }

  listMemberships(orgId: string) {
    return this.db.select().from(memberships).where(eq(memberships.orgId, orgId));
  }

  async createMembership(orgId: string, input: CreateMembership) {
    return this.db.transaction(async (tx) => {
      const [membership] = await tx
        .insert(memberships)
        .values({
          orgId,
          userId: input.userId,
          role: input.role,
          status: input.status ?? "active",
        })
        .returning();

      if (input.branchIds?.length) {
        await tx.insert(membershipBranches).values(
          input.branchIds.map((branchId) => ({
            orgId,
            membershipId: membership.id,
            branchId,
          })),
        );
      }

      return membership;
    });
  }

  findMembership(orgId: string, id: string) {
    return this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.id, id)))
      .then((rows) => rows[0] ?? null);
  }
}
