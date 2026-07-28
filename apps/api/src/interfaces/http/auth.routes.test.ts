import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuthUseCases,
  type AccessTokenSigner,
  type AuthConfig,
  type AuthDeps,
  type AuthMembershipRecord,
  type AuthUserRecord,
  type AuthUserStore,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type MailMessage,
  type Mailer,
  type OpaqueTokenService,
  type PasswordHasher,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from "@stock-management/application";
import { TokenExpiredError } from "@stock-management/domain";
import { JoseAccessTokenSigner } from "../../infrastructure/auth/crypto.js";
import { authRoutes } from "./auth.routes.js";
import {
  createContextPlugin,
  createTestContextPlugin,
} from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const FIXED_NOW = new Date("2026-07-27T10:00:00.000Z");
const COOKIE_NAME = "refresh_token";

function defaultConfig(): AuthConfig {
  return {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 14 * 24 * 60 * 60,
    emailVerifyTtlSeconds: 24 * 60 * 60,
    passwordResetTtlSeconds: 60 * 60,
    appPublicUrl: "http://localhost:5173",
  };
}

function createAuthHarness(accessTokens: AccessTokenSigner) {
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

  const opaqueTokens: OpaqueTokenService = {
    issue() {
      tokenSeq += 1;
      return `opaque-${tokenSeq}`;
    },
    hash(raw) {
      return `sha256:${raw}`;
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
        if (row.familyId === familyId) row.revokedAt = revokedAt;
      }
    },
    async revokeAllForUser(userId, revokedAt) {
      for (const row of refreshRows) {
        if (row.userId === userId) row.revokedAt = revokedAt;
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
        if (
          row.userId === userId &&
          row.purpose === purpose &&
          row.usedAt === null
        ) {
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
    clock: { now: () => now },
    config: defaultConfig(),
  };

  return {
    useCases: new AuthUseCases(deps),
    mailLog,
    emailRows,
    opaqueTokens,
    users,
    setNow(d: Date) {
      now = d;
    },
  };
}

function cookieHeader(setCookie: string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) return "";
  return raw.split(";")[0] ?? "";
}

async function buildAuthApp(accessTokens: AccessTokenSigner) {
  const harness = createAuthHarness(accessTokens);
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(requestIdPlugin);
  await app.register(cookie);
  await app.register(
    authRoutes(harness.useCases, {
      cookieName: COOKIE_NAME,
      secureCookies: false,
      accessTokenVerifier: accessTokens,
    }),
    { prefix: "/api/v1" },
  );
  return { app, harness };
}

describe("auth routes", () => {
  const accessTokens = new JoseAccessTokenSigner(
    "test-jwt-secret-for-auth-routes",
    900,
  );
  let app: Awaited<ReturnType<typeof buildAuthApp>>["app"];
  let harness: Awaited<ReturnType<typeof buildAuthApp>>["harness"];

  afterEach(async () => {
    await app.close();
  });

  async function signupAndVerify(email = "owner@example.com") {
    const signup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "password1",
        name: "Owner",
        orgName: "Acme",
      },
    });
    expect(signup.statusCode).toBe(201);
    const body = signup.json() as {
      userId: string;
      orgId: string;
      email: string;
    };
    const mail = harness.mailLog.at(-1);
    const linkMatch = mail?.text.match(/\?token=([^\s]+)/);
    expect(linkMatch?.[1]).toBeTruthy();
    const verifyToken = decodeURIComponent(linkMatch![1]!);
    const verify = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      payload: { token: verifyToken },
    });
    expect(verify.statusCode).toBe(204);
    return body;
  }

  it("signup returns 201 without session cookies", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "a@example.com",
        password: "password1",
        name: "A",
        orgName: "Org",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(
      expect.objectContaining({
        email: "a@example.com",
        userId: expect.any(String),
        orgId: expect.any(String),
      }),
    );
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("login sets refresh cookie and returns access token", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    await signupAndVerify("login@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "login@example.com", password: "password1" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accessToken: string; email: string };
    expect(body.accessToken).toBeTruthy();
    expect(body.email).toBe("login@example.com");
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain(`${COOKIE_NAME}=`);
    expect(String(setCookie).toLowerCase()).toContain("httponly");
    expect(String(setCookie).toLowerCase()).toContain("path=/api/v1/auth");
  });

  it("login with unverified email returns EMAIL_NOT_VERIFIED", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "unverified@example.com",
        password: "password1",
        name: "U",
        orgName: "Org",
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "unverified@example.com", password: "password1" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("refresh rotates cookie using httpOnly cookie", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    await signupAndVerify("refresh@example.com");
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "refresh@example.com", password: "password1" },
    });
    const cookie = cookieHeader(login.headers["set-cookie"]);
    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json().accessToken).toBeTruthy();
    expect(String(refresh.headers["set-cookie"])).toContain(`${COOKIE_NAME}=`);
  });

  it("GET /me requires Bearer and returns memberships", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    const created = await signupAndVerify("me@example.com");
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "me@example.com", password: "password1" },
    });
    const { accessToken } = login.json() as { accessToken: string };

    const unauthorized = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(unauthorized.statusCode).toBe(401);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: created.userId,
          email: "me@example.com",
        }),
        memberships: [
          expect.objectContaining({
            orgId: created.orgId,
            role: "org_admin",
          }),
        ],
      }),
    );
  });

  it("forgot-password always returns 204", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email: "nobody@example.com" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("logout clears refresh cookie", async () => {
    ({ app, harness } = await buildAuthApp(accessTokens));
    await signupAndVerify("out@example.com");
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "out@example.com", password: "password1" },
    });
    const cookie = cookieHeader(login.headers["set-cookie"]);
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers["set-cookie"]).toLowerCase()).toMatch(
      /max-age=0|expires=thu, 01 jan 1970/i,
    );
  });
});

describe("JWT context plugin", () => {
  const accessTokens = new JoseAccessTokenSigner(
    "test-jwt-secret-for-context",
    900,
  );
  let app: Awaited<ReturnType<typeof Fastify>>;

  afterEach(async () => {
    await app.close();
  });

  it("rejects protected route without Bearer when AUTH_STUB is off", async () => {
    app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(
      createContextPlugin({
        membershipAccess: {
          findActiveByUser: async () => ({
            id: randomUUID(),
            orgId: "00000000-0000-4000-8000-000000000001",
            userId: "00000000-0000-4000-8000-000000000002",
            role: "org_admin",
            status: "active",
            branchIds: [],
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
        },
        accessTokens,
        authStub: false,
      }),
    );
    app.get("/api/v1/ping", async (request) => ({
      userId: request.ctx.userId,
      orgId: request.ctx.orgId,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ping",
      headers: {
        "x-org-id": "00000000-0000-4000-8000-000000000001",
        "x-user-id": "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("accepts Bearer JWT and ignores X-User-Id", async () => {
    const userId = "00000000-0000-4000-8000-000000000002";
    const orgId = "00000000-0000-4000-8000-000000000001";
    const token = await accessTokens.sign({
      sub: userId,
      email: "u@example.com",
    });

    app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(
      createContextPlugin({
        membershipAccess: {
          findActiveByUser: async (o, u) => ({
            id: randomUUID(),
            orgId: o,
            userId: u,
            role: "org_admin",
            status: "active",
            branchIds: [],
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
        },
        accessTokens,
        authStub: false,
      }),
    );
    app.get("/api/v1/ping", async (request) => ({
      userId: request.ctx.userId,
      orgId: request.ctx.orgId,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ping",
      headers: {
        authorization: `Bearer ${token}`,
        "x-org-id": orgId,
        "x-user-id": "00000000-0000-4000-8000-999999999999",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId, orgId });
  });

  it("maps expired access JWT to TOKEN_EXPIRED", async () => {
    const expiredSigner: AccessTokenSigner = {
      async sign() {
        return "expired.jwt";
      },
      async verify() {
        throw new TokenExpiredError();
      },
    };

    app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(
      createContextPlugin({
        membershipAccess: {
          findActiveByUser: async () => null,
        },
        accessTokens: expiredSigner,
        authStub: false,
      }),
    );
    app.get("/api/v1/ping", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ping",
      headers: {
        authorization: "Bearer expired.jwt",
        "x-org-id": "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("TOKEN_EXPIRED");
  });

  it("AUTH_STUB / createTestContextPlugin still accepts X-User-Id", async () => {
    app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    app.get("/api/v1/ping", async (request) => ({
      userId: request.ctx.userId,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ping",
      headers: {
        "x-org-id": "00000000-0000-4000-8000-000000000001",
        "x-user-id": "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe("00000000-0000-4000-8000-000000000002");
  });
});
