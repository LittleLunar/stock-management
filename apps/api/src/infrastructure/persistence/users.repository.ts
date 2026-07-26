import { and, eq } from "drizzle-orm";
import type {
  CreateMembershipInput,
  CreateUserInput,
  UsersRepository,
} from "@stock-management/application";
import type { Membership, User } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { membershipBranches, memberships, users } from "../db/schema/index.js";

export class DrizzleUsersRepository implements UsersRepository {
  constructor(private readonly db: Db) {}

  listUsers(orgId: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.orgId, orgId)) as Promise<User[]>;
  }

  async createUser(orgId: string, input: CreateUserInput): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        orgId,
        email: input.email,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row as User;
  }

  listMemberships(orgId: string): Promise<Membership[]> {
    return this.db
      .select()
      .from(memberships)
      .where(eq(memberships.orgId, orgId)) as Promise<Membership[]>;
  }

  async createMembership(
    orgId: string,
    input: CreateMembershipInput,
  ): Promise<Membership> {
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

      return membership as Membership;
    });
  }

  findMembership(orgId: string, id: string): Promise<Membership | null> {
    return this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.id, id)))
      .then((rows) => (rows[0] as Membership | undefined) ?? null);
  }
}
