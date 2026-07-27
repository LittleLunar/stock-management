import { randomUUID } from "node:crypto";
import {
  ConflictError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenInvalidError,
  UnauthorizedError,
} from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  AuthConfig,
  AuthDeps,
  AuthMembershipRecord,
  AuthUserRecord,
  EmailTokenPurpose,
  EmailTokenRecord,
  EmailTokenStore,
  MailMessage,
  Mailer,
  OpaqueTokenService,
  PasswordHasher,
  RefreshTokenRecord,
  RefreshTokenStore,
  AccessTokenSigner,
  AuthUserStore,
} from "../ports/auth.js";
import { AuthUseCases } from "./auth.js";

const FIXED_NOW = new Date("2026-07-27T10:00:00.000Z");

function defaultConfig(): AuthConfig {
  return {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 14 * 24 * 60 * 60,
    emailVerifyTtlSeconds: 24 * 60 * 60,
    passwordResetTtlSeconds: 60 * 60,
    appPublicUrl: "http://localhost:5173",
  };
}

function createHarness(overrides?: Partial<AuthDeps>) {
  const users = new Map<string, AuthUserRecord>();
  const usersByEmail = new Map<string, string>();
  const memberships = new Map<string, AuthMembershipRecord[]>();
  const refreshRows: RefreshTokenRecord[] = [];
  const emailRows: EmailTokenRecord[] = [];
  const mailLog: MailMessage[] = [];
  let now = new Date(FIXED_NOW);
  let tokenSeq = 0;

  const userStore: AuthUserStore = {
    async findByEmail(email) {
      const id = usersByEmail.get(email.toLowerCase());
      return id ? (users.get(id) ?? null) : null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async createSignup(input) {
      if (usersByEmail.has(input.email.toLowerCase())) {
        throw new ConflictError("Email already registered");
      }
      const orgId = randomUUID();
      const userId = randomUUID();
      const row: AuthUserRecord = {
        id: userId,
        orgId,
        email: input.email.toLowerCase(),
        name: input.name,
        status: "active",
        passwordHash: input.passwordHash,
        emailVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      users.set(userId, row);
      usersByEmail.set(row.email, userId);
      memberships.set(userId, [
        {
          id: randomUUID(),
          orgId,
          orgName: input.orgName,
          userId,
          role: "org_admin",
          status: "active",
          branchIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ]);
      return { userId, orgId, email: row.email };
    },
    async setEmailVerified(userId, at) {
      const row = users.get(userId);
      if (!row) return;
      row.emailVerifiedAt = at;
      row.updatedAt = at;
    },
    async updatePasswordHash(userId, passwordHash) {
      const row = users.get(userId);
      if (!row) return;
      row.passwordHash = passwordHash;
      row.updatedAt = now;
    },
    async listMembershipsForUser(userId) {
      return memberships.get(userId) ?? [];
    },
  };

  const passwords: PasswordHasher = {
    async hash(password) {
      return `hash:${password}`;
    },
    async verify(password, hash) {
      return hash === `hash:${password}`;
    },
  };

  const accessTokens: AccessTokenSigner = {
    async sign(claims) {
      return `access:${claims.sub}:${claims.email}`;
    },
    async verify(token) {
      const m = /^access:([^:]+):(.+)$/.exec(token);
      if (!m) throw new TokenInvalidError();
      return { sub: m[1], email: m[2] };
    },
  };

  const opaqueTokens: OpaqueTokenService = {
    issue() {
      tokenSeq += 1;
      return `raw-token-${tokenSeq}`;
    },
    hash(rawToken) {
      return `sha:${rawToken}`;
    },
  };

  const refreshTokens: RefreshTokenStore = {
    async insert(input) {
      const row: RefreshTokenRecord = {
        id: randomUUID(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: now,
      };
      refreshRows.push(row);
      return row;
    },
    async findByTokenHash(tokenHash) {
      return refreshRows.find((r) => r.tokenHash === tokenHash) ?? null;
    },
    async revoke(id, revokedAt) {
      const row = refreshRows.find((r) => r.id === id);
      if (row) row.revokedAt = revokedAt;
    },
    async revokeFamily(familyId, revokedAt) {
      for (const row of refreshRows) {
        if (row.familyId === familyId && !row.revokedAt) {
          row.revokedAt = revokedAt;
        }
      }
    },
    async revokeAllForUser(userId, revokedAt) {
      for (const row of refreshRows) {
        if (row.userId === userId && !row.revokedAt) {
          row.revokedAt = revokedAt;
        }
      }
    },
  };

  const emailTokens: EmailTokenStore = {
    async insert(input) {
      const row: EmailTokenRecord = {
        id: randomUUID(),
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
      };
      emailRows.push(row);
      return row;
    },
    async findByTokenHash(tokenHash, purpose: EmailTokenPurpose) {
      return (
        emailRows.find(
          (r) => r.tokenHash === tokenHash && r.purpose === purpose,
        ) ?? null
      );
    },
    async markUsed(id, usedAt) {
      const row = emailRows.find((r) => r.id === id);
      if (row) row.usedAt = usedAt;
    },
    async invalidateUnused(userId, purpose) {
      for (const row of emailRows) {
        if (row.userId === userId && row.purpose === purpose && !row.usedAt) {
          row.usedAt = now;
        }
      }
    },
  };

  const mailer: Mailer = {
    async send(message) {
      mailLog.push(message);
    },
  };

  const deps: AuthDeps = {
    users: userStore,
    passwords,
    accessTokens,
    opaqueTokens,
    refreshTokens,
    emailTokens,
    mailer,
    clock: { now: () => new Date(now) },
    config: defaultConfig(),
    ...overrides,
  };

  return {
    uc: new AuthUseCases(deps),
    deps,
    users,
    usersByEmail,
    memberships,
    refreshRows,
    emailRows,
    mailLog,
    setNow(d: Date) {
      now = d;
    },
    seedVerifiedUser(partial?: Partial<AuthUserRecord>) {
      const userId = partial?.id ?? randomUUID();
      const orgId = partial?.orgId ?? randomUUID();
      const email = (partial?.email ?? "admin@example.com").toLowerCase();
      const row: AuthUserRecord = {
        id: userId,
        orgId,
        email,
        name: partial?.name ?? "Admin",
        status: "active",
        passwordHash: partial?.passwordHash ?? "hash:secret",
        emailVerifiedAt: partial?.emailVerifiedAt ?? FIXED_NOW,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        ...partial,
      };
      users.set(userId, row);
      usersByEmail.set(email, userId);
      memberships.set(userId, [
        {
          id: randomUUID(),
          orgId,
          orgName: "Demo Org",
          userId,
          role: "org_admin",
          status: "active",
          branchIds: [],
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
      ]);
      return row;
    },
  };
}

describe("AuthUseCases", () => {
  describe("signup", () => {
    it("creates org+user, sends verification email, returns ids without session", async () => {
      const h = createHarness();
      const result = await h.uc.signup({
        email: "Admin@Example.com",
        password: "s3cret-pass",
        name: "Admin",
        orgName: "Acme Shop",
      });

      expect(result.userId).toBeTruthy();
      expect(result.orgId).toBeTruthy();
      expect(result.email).toBe("admin@example.com");
      expect(h.mailLog).toHaveLength(1);
      expect(h.mailLog[0].to).toBe("admin@example.com");
      expect(h.mailLog[0].text).toContain("token=");
      expect(h.emailRows).toHaveLength(1);
      expect(h.emailRows[0].purpose).toBe("verify_email");
      const user = h.users.get(result.userId)!;
      expect(user.passwordHash).toBe("hash:s3cret-pass");
      expect(user.emailVerifiedAt).toBeNull();
    });

    it("rejects duplicate email with ConflictError", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ email: "taken@example.com" });
      await expect(
        h.uc.signup({
          email: "taken@example.com",
          password: "x",
          name: "X",
          orgName: "Org",
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("login", () => {
    it("returns access + refresh session for verified user", async () => {
      const h = createHarness();
      const user = h.seedVerifiedUser({
        email: "admin@example.com",
        passwordHash: "hash:secret",
      });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "secret",
      });
      expect(session.accessToken).toBe(`access:${user.id}:admin@example.com`);
      expect(session.refreshToken).toMatch(/^raw-token-/);
      expect(h.refreshRows).toHaveLength(1);
      expect(h.refreshRows[0].revokedAt).toBeNull();
    });

    it("throws InvalidCredentials for bad password", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ passwordHash: "hash:secret" });
      await expect(
        h.uc.login({ email: "admin@example.com", password: "wrong" }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("throws InvalidCredentials for unknown email", async () => {
      const h = createHarness();
      await expect(
        h.uc.login({ email: "missing@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("throws EmailNotVerified when email not verified", async () => {
      const h = createHarness();
      h.seedVerifiedUser({
        emailVerifiedAt: null,
        passwordHash: "hash:secret",
      });
      await expect(
        h.uc.login({ email: "admin@example.com", password: "secret" }),
      ).rejects.toBeInstanceOf(EmailNotVerifiedError);
    });
  });

  describe("verifyEmail", () => {
    it("marks email verified and consumes token", async () => {
      const h = createHarness();
      const signed = await h.uc.signup({
        email: "new@example.com",
        password: "pass",
        name: "New",
        orgName: "Org",
      });
      const raw = "raw-token-1";
      await h.uc.verifyEmail({ token: raw });
      const user = h.users.get(signed.userId)!;
      expect(user.emailVerifiedAt).toEqual(FIXED_NOW);
      expect(h.emailRows[0].usedAt).toEqual(FIXED_NOW);
    });

    it("rejects expired token", async () => {
      const h = createHarness();
      await h.uc.signup({
        email: "new@example.com",
        password: "pass",
        name: "New",
        orgName: "Org",
      });
      h.setNow(new Date("2026-07-29T12:00:00.000Z"));
      await expect(
        h.uc.verifyEmail({ token: "raw-token-1" }),
      ).rejects.toBeInstanceOf(TokenExpiredError);
    });

    it("rejects reused token", async () => {
      const h = createHarness();
      await h.uc.signup({
        email: "new@example.com",
        password: "pass",
        name: "New",
        orgName: "Org",
      });
      await h.uc.verifyEmail({ token: "raw-token-1" });
      await expect(
        h.uc.verifyEmail({ token: "raw-token-1" }),
      ).rejects.toBeInstanceOf(TokenInvalidError);
    });
  });

  describe("refresh", () => {
    it("rotates refresh token and issues new access token", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ passwordHash: "hash:secret" });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "secret",
      });
      const next = await h.uc.refresh({ refreshToken: session.refreshToken });
      expect(next.refreshToken).not.toBe(session.refreshToken);
      expect(next.accessToken).toContain("access:");
      expect(h.refreshRows[0].revokedAt).toEqual(FIXED_NOW);
      expect(h.refreshRows[1].familyId).toBe(h.refreshRows[0].familyId);
      expect(h.refreshRows[1].revokedAt).toBeNull();
    });

    it("revokes family on reuse of revoked token", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ passwordHash: "hash:secret" });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "secret",
      });
      await h.uc.refresh({ refreshToken: session.refreshToken });
      await expect(
        h.uc.refresh({ refreshToken: session.refreshToken }),
      ).rejects.toBeInstanceOf(TokenInvalidError);
      expect(h.refreshRows.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it("rejects expired refresh token", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ passwordHash: "hash:secret" });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "secret",
      });
      h.setNow(new Date("2026-09-01T00:00:00.000Z"));
      await expect(
        h.uc.refresh({ refreshToken: session.refreshToken }),
      ).rejects.toBeInstanceOf(TokenExpiredError);
    });
  });

  describe("logout", () => {
    it("revokes refresh token family", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ passwordHash: "hash:secret" });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "secret",
      });
      await h.uc.logout({ refreshToken: session.refreshToken });
      expect(h.refreshRows[0].revokedAt).toEqual(FIXED_NOW);
      await expect(
        h.uc.refresh({ refreshToken: session.refreshToken }),
      ).rejects.toBeInstanceOf(TokenInvalidError);
    });

    it("is a no-op for unknown refresh token", async () => {
      const h = createHarness();
      await expect(
        h.uc.logout({ refreshToken: "missing" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("forgotPassword / resetPassword", () => {
    it("forgotPassword always succeeds and does not reveal missing email", async () => {
      const h = createHarness();
      await expect(
        h.uc.forgotPassword({ email: "nobody@example.com" }),
      ).resolves.toBeUndefined();
      expect(h.mailLog).toHaveLength(0);
    });

    it("sends reset mail for known email", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ email: "admin@example.com" });
      await h.uc.forgotPassword({ email: "admin@example.com" });
      expect(h.mailLog).toHaveLength(1);
      expect(h.emailRows[0].purpose).toBe("reset_password");
    });

    it("resetPassword updates hash and revokes all refresh families", async () => {
      const h = createHarness();
      h.seedVerifiedUser({
        email: "admin@example.com",
        passwordHash: "hash:old",
      });
      const session = await h.uc.login({
        email: "admin@example.com",
        password: "old",
      });
      await h.uc.forgotPassword({ email: "admin@example.com" });
      const resetRaw = "raw-token-2";
      await h.uc.resetPassword({ token: resetRaw, newPassword: "new-pass" });
      const user = [...h.users.values()][0];
      expect(user.passwordHash).toBe("hash:new-pass");
      expect(h.refreshRows.every((r) => r.revokedAt !== null)).toBe(true);
      await expect(
        h.uc.refresh({ refreshToken: session.refreshToken }),
      ).rejects.toBeInstanceOf(TokenInvalidError);
      const next = await h.uc.login({
        email: "admin@example.com",
        password: "new-pass",
      });
      expect(next.accessToken).toContain("access:");
    });
  });

  describe("resendVerification", () => {
    it("sends a new verification email without revealing missing users", async () => {
      const h = createHarness();
      await expect(
        h.uc.resendVerification({ email: "ghost@example.com" }),
      ).resolves.toBeUndefined();
      expect(h.mailLog).toHaveLength(0);

      await h.uc.signup({
        email: "new@example.com",
        password: "pass",
        name: "New",
        orgName: "Org",
      });
      await h.uc.resendVerification({ email: "new@example.com" });
      expect(h.mailLog.length).toBeGreaterThanOrEqual(2);
      expect(h.emailRows.filter((e) => e.purpose === "verify_email").length).toBe(
        2,
      );
    });

    it("no-ops when already verified", async () => {
      const h = createHarness();
      h.seedVerifiedUser({ email: "admin@example.com" });
      await h.uc.resendVerification({ email: "admin@example.com" });
      expect(h.mailLog).toHaveLength(0);
    });
  });

  describe("getMe", () => {
    it("returns user without passwordHash and memberships", async () => {
      const h = createHarness();
      const user = h.seedVerifiedUser();
      const me = await h.uc.getMe({ userId: user.id });
      expect(me.user).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });
      expect(me.user).not.toHaveProperty("passwordHash");
      expect(me.memberships).toHaveLength(1);
      expect(me.memberships[0].role).toBe("org_admin");
    });

    it("throws Unauthorized for unknown user", async () => {
      const h = createHarness();
      await expect(
        h.uc.getMe({ userId: randomUUID() }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
