import { and, eq } from "drizzle-orm";
import type {
  CreateMembershipInput,
  CreateUserInput,
  MembershipAccessPort,
  UsersRepository,
} from "@stock-management/application";
import type { Membership, User } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { membershipBranches, memberships, users } from "../db/schema/index.js";

type DbLike = Pick<Db, "select">;

async function branchIdsFor(
  db: DbLike,
  orgId: string,
  membershipId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: membershipBranches.branchId })
    .from(membershipBranches)
    .where(
      and(
        eq(membershipBranches.orgId, orgId),
        eq(membershipBranches.membershipId, membershipId),
      ),
    );
  return rows.map((r) => r.branchId);
}

function toMembership(
  row: typeof memberships.$inferSelect,
  branchIds: string[],
): Membership {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    role: row.role as Membership["role"],
    status: row.status as Membership["status"],
    branchIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUsersRepository
  implements UsersRepository, MembershipAccessPort
{
  constructor(private readonly db: Db) {}

  listUsers(orgId: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.orgId, orgId)) as Promise<
      User[]
    >;
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

  async listMemberships(orgId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.orgId, orgId));
    return Promise.all(
      rows.map(async (row) =>
        toMembership(row, await branchIdsFor(this.db, orgId, row.id)),
      ),
    );
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

      const branchIds = input.branchIds ?? [];
      if (branchIds.length) {
        await tx.insert(membershipBranches).values(
          branchIds.map((branchId) => ({
            orgId,
            membershipId: membership.id,
            branchId,
          })),
        );
      }

      return toMembership(membership, branchIds);
    });
  }

  async findMembership(orgId: string, id: string): Promise<Membership | null> {
    const [row] = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.id, id)))
      .limit(1);
    if (!row) return null;
    return toMembership(row, await branchIdsFor(this.db, orgId, row.id));
  }

  async findActiveByUser(
    orgId: string,
    userId: string,
  ): Promise<Membership | null> {
    const [row] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.orgId, orgId),
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
        ),
      )
      .limit(1);
    if (!row) return null;
    return toMembership(row, await branchIdsFor(this.db, orgId, row.id));
  }
}
