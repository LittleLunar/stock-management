import { and, eq } from "drizzle-orm";
import type {
  NotificationRecipientDirectory,
  NotificationUserRef,
} from "@stock-management/application";
import type { MembershipRole } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  membershipBranches,
  memberships,
  users,
} from "../db/schema/index.js";

export class DrizzleNotificationRecipientDirectory
  implements NotificationRecipientDirectory
{
  constructor(private readonly db: DbClient) {}

  async listActiveMembers(orgId: string): Promise<NotificationUserRef[]> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: memberships.role,
        membershipId: memberships.id,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.orgId, orgId),
          eq(memberships.status, "active"),
          eq(users.status, "active"),
        ),
      );

    const result: NotificationUserRef[] = [];
    for (const row of rows) {
      const branches = await this.db
        .select({ branchId: membershipBranches.branchId })
        .from(membershipBranches)
        .where(eq(membershipBranches.membershipId, row.membershipId));
      result.push({
        id: row.id,
        email: row.email,
        role: row.role as MembershipRole,
        branchIds: branches.map((b) => b.branchId),
      });
    }
    return result;
  }

  async findUserById(
    userId: string,
  ): Promise<{ id: string; email: string } | null> {
    const [row] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string } | null> {
    const [row] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return row ?? null;
  }
}
