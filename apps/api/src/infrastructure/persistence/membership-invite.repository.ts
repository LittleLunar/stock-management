import { and, eq, isNull } from "drizzle-orm";
import type {
  MembershipInviteRecord,
  MembershipInviteStore,
} from "@stock-management/application";
import { ConflictError } from "@stock-management/domain";
import type { MembershipRole } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import {
  membershipBranches,
  membershipInvites,
  memberships,
  organizations,
  users,
} from "../db/schema/index.js";

function toInvite(
  row: typeof membershipInvites.$inferSelect,
): MembershipInviteRecord {
  const branchIds = Array.isArray(row.branchIds)
    ? (row.branchIds as string[])
    : [];
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    role: row.role as MembershipRole,
    branchIds,
    tokenHash: row.tokenHash,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    declinedAt: row.declinedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleMembershipInviteStore implements MembershipInviteStore {
  constructor(private readonly db: Db) {}

  async insert(input: {
    orgId: string;
    email: string;
    role: MembershipRole;
    branchIds: string[];
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<MembershipInviteRecord> {
    const [row] = await this.db
      .insert(membershipInvites)
      .values({
        orgId: input.orgId,
        email: input.email,
        role: input.role,
        branchIds: input.branchIds,
        tokenHash: input.tokenHash,
        invitedBy: input.invitedBy,
        expiresAt: input.expiresAt,
      })
      .returning();
    return toInvite(row);
  }

  async findByTokenHash(tokenHash: string): Promise<MembershipInviteRecord | null> {
    const [row] = await this.db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.tokenHash, tokenHash))
      .limit(1);
    return row ? toInvite(row) : null;
  }

  async findPendingByOrgEmail(
    orgId: string,
    email: string,
  ): Promise<MembershipInviteRecord | null> {
    const [row] = await this.db
      .select()
      .from(membershipInvites)
      .where(
        and(
          eq(membershipInvites.orgId, orgId),
          eq(membershipInvites.email, email),
          isNull(membershipInvites.acceptedAt),
          isNull(membershipInvites.declinedAt),
        ),
      )
      .limit(1);
    return row ? toInvite(row) : null;
  }

  async cancelPendingByOrgEmail(
    orgId: string,
    email: string,
    at: Date,
  ): Promise<void> {
    await this.db
      .update(membershipInvites)
      .set({ declinedAt: at, updatedAt: at })
      .where(
        and(
          eq(membershipInvites.orgId, orgId),
          eq(membershipInvites.email, email),
          isNull(membershipInvites.acceptedAt),
          isNull(membershipInvites.declinedAt),
        ),
      );
  }

  async markAccepted(id: string, acceptedAt: Date): Promise<void> {
    await this.db
      .update(membershipInvites)
      .set({ acceptedAt, updatedAt: acceptedAt })
      .where(eq(membershipInvites.id, id));
  }

  async markDeclined(id: string, declinedAt: Date): Promise<void> {
    await this.db
      .update(membershipInvites)
      .set({ declinedAt, updatedAt: declinedAt })
      .where(eq(membershipInvites.id, id));
  }

  async acceptCreateUserAndMembership(input: {
    inviteId: string;
    orgId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: MembershipRole;
    branchIds: string[];
    acceptedAt: Date;
  }): Promise<{ userId: string; membershipId: string }> {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            orgId: input.orgId,
            email: input.email,
            name: input.name,
            passwordHash: input.passwordHash,
            emailVerifiedAt: input.acceptedAt,
            status: "active",
          })
          .returning();

        const [membership] = await tx
          .insert(memberships)
          .values({
            orgId: input.orgId,
            userId: user.id,
            role: input.role,
            status: "active",
          })
          .returning();

        if (input.branchIds.length) {
          await tx.insert(membershipBranches).values(
            input.branchIds.map((branchId) => ({
              orgId: input.orgId,
              membershipId: membership.id,
              branchId,
            })),
          );
        }

        await tx
          .update(membershipInvites)
          .set({
            acceptedAt: input.acceptedAt,
            updatedAt: input.acceptedAt,
          })
          .where(eq(membershipInvites.id, input.inviteId));

        return { userId: user.id, membershipId: membership.id };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("users_email_uidx") || message.includes("unique")) {
        throw new ConflictError("Email already registered");
      }
      throw err;
    }
  }

  async findOrgName(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return row?.name ?? null;
  }

  async emailRegistered(email: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return Boolean(row);
  }
}
