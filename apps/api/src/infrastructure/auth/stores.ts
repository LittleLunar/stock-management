import { and, eq, isNull } from "drizzle-orm";
import type {
  AuthMembershipRecord,
  AuthUserRecord,
  AuthUserStore,
  EmailTokenPurpose,
  EmailTokenRecord,
  EmailTokenStore,
  RefreshTokenRecord,
  RefreshTokenStore,
  SignupResult,
} from "@stock-management/application";
import { ConflictError } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import {
  authEmailTokens,
  authRefreshTokens,
  membershipBranches,
  memberships,
  organizations,
  users,
} from "../db/schema/index.js";

function toAuthUser(row: typeof users.$inferSelect): AuthUserRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    name: row.name,
    status: row.status as AuthUserRecord["status"],
    passwordHash: row.passwordHash,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRefresh(row: typeof authRefreshTokens.$inferSelect): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    familyId: row.familyId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

function toEmailToken(row: typeof authEmailTokens.$inferSelect): EmailTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose as EmailTokenPurpose,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
  };
}

export class DrizzleAuthUserStore implements AuthUserStore {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return row ? toAuthUser(row) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toAuthUser(row) : null;
  }

  async createSignup(input: {
    email: string;
    name: string;
    passwordHash: string;
    orgName: string;
  }): Promise<SignupResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({ name: input.orgName })
          .returning();

        const [user] = await tx
          .insert(users)
          .values({
            orgId: org.id,
            email: input.email.toLowerCase(),
            name: input.name,
            passwordHash: input.passwordHash,
            emailVerifiedAt: null,
            status: "active",
          })
          .returning();

        await tx.insert(memberships).values({
          orgId: org.id,
          userId: user.id,
          role: "org_admin",
          status: "active",
        });

        return {
          userId: user.id,
          orgId: org.id,
          email: user.email,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("users_email_uidx") || message.includes("unique")) {
        throw new ConflictError("Email already registered");
      }
      throw err;
    }
  }

  async setEmailVerified(userId: string, at: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerifiedAt: at, updatedAt: at })
      .where(eq(users.id, userId));
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async listMembershipsForUser(userId: string): Promise<AuthMembershipRecord[]> {
    const rows = await this.db
      .select({
        membership: memberships,
        orgName: organizations.name,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(eq(memberships.userId, userId));

    return Promise.all(
      rows.map(async ({ membership, orgName }) => {
        const branchRows = await this.db
          .select({ branchId: membershipBranches.branchId })
          .from(membershipBranches)
          .where(
            and(
              eq(membershipBranches.orgId, membership.orgId),
              eq(membershipBranches.membershipId, membership.id),
            ),
          );
        return {
          id: membership.id,
          orgId: membership.orgId,
          orgName,
          userId: membership.userId,
          role: membership.role as AuthMembershipRecord["role"],
          status: membership.status as AuthMembershipRecord["status"],
          branchIds: branchRows.map((b) => b.branchId),
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        };
      }),
    );
  }
}

export class DrizzleRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly db: Db) {}

  async insert(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const [row] = await this.db
      .insert(authRefreshTokens)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      })
      .returning();
    return toRefresh(row);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [row] = await this.db
      .select()
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toRefresh(row) : null;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({ revokedAt })
      .where(eq(authRefreshTokens.id, id));
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({ revokedAt })
      .where(
        and(
          eq(authRefreshTokens.familyId, familyId),
          isNull(authRefreshTokens.revokedAt),
        ),
      );
  }

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({ revokedAt })
      .where(
        and(
          eq(authRefreshTokens.userId, userId),
          isNull(authRefreshTokens.revokedAt),
        ),
      );
  }
}

export class DrizzleEmailTokenStore implements EmailTokenStore {
  constructor(private readonly db: Db) {}

  async insert(input: {
    userId: string;
    purpose: EmailTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailTokenRecord> {
    const [row] = await this.db
      .insert(authEmailTokens)
      .values({
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    return toEmailToken(row);
  }

  async findByTokenHash(
    tokenHash: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | null> {
    const [row] = await this.db
      .select()
      .from(authEmailTokens)
      .where(
        and(
          eq(authEmailTokens.tokenHash, tokenHash),
          eq(authEmailTokens.purpose, purpose),
        ),
      )
      .limit(1);
    return row ? toEmailToken(row) : null;
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    await this.db
      .update(authEmailTokens)
      .set({ usedAt })
      .where(eq(authEmailTokens.id, id));
  }

  async invalidateUnused(
    userId: string,
    purpose: EmailTokenPurpose,
  ): Promise<void> {
    await this.db
      .update(authEmailTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authEmailTokens.userId, userId),
          eq(authEmailTokens.purpose, purpose),
          isNull(authEmailTokens.usedAt),
        ),
      );
  }
}
