import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  MembershipInviteUseCases,
  type EnqueueNotificationIntent,
  type MembershipInviteDeps,
  type MembershipInviteRecord,
  type MembershipInviteStore,
  type NotificationIntent,
  type MailMessage,
  type Mailer,
  type OpaqueTokenService,
  type PasswordHasher,
} from "@stock-management/application";
import { ConflictError, InvalidStateError } from "@stock-management/domain";
import { membershipInviteRoutes } from "./membership-invites.routes.js";
import {
  createTestContextPlugin,
  createTestContextPluginWith,
} from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";
import type { MembershipAccessPort } from "@stock-management/application";

const FIXED_NOW = new Date("2026-07-27T12:00:00.000Z");
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_USER = "22222222-2222-4222-8222-222222222222";

function createInviteHarness() {
  const invites = new Map<string, MembershipInviteRecord>();
  const invitesByHash = new Map<string, string>();
  const registeredEmails = new Set<string>();
  const mailLog: MailMessage[] = [];
  const notificationLog: NotificationIntent[] = [];
  let now = new Date(FIXED_NOW);
  let tokenSeq = 0;
  const rawByInviteId = new Map<string, string>();

  const store: MembershipInviteStore = {
    async insert(input) {
      const id = randomUUID();
      const row: MembershipInviteRecord = {
        id,
        orgId: input.orgId,
        email: input.email,
        role: input.role,
        branchIds: input.branchIds,
        tokenHash: input.tokenHash,
        invitedBy: input.invitedBy,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        declinedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      invites.set(id, row);
      invitesByHash.set(row.tokenHash, id);
      return row;
    },
    async findByTokenHash(tokenHash) {
      const id = invitesByHash.get(tokenHash);
      return id ? (invites.get(id) ?? null) : null;
    },
    async findPendingByOrgEmail(orgId, email) {
      for (const row of invites.values()) {
        if (
          row.orgId === orgId &&
          row.email === email &&
          !row.acceptedAt &&
          !row.declinedAt
        ) {
          return row;
        }
      }
      return null;
    },
    async cancelPendingByOrgEmail(orgId, email, at) {
      for (const row of invites.values()) {
        if (
          row.orgId === orgId &&
          row.email === email &&
          !row.acceptedAt &&
          !row.declinedAt
        ) {
          row.declinedAt = at;
          row.updatedAt = at;
        }
      }
    },
    async markDeclined(id, declinedAt) {
      const row = invites.get(id);
      if (
        !row ||
        row.acceptedAt ||
        row.declinedAt ||
        row.expiresAt.getTime() <= declinedAt.getTime()
      ) {
        throw new InvalidStateError("Invite is no longer pending");
      }
      row.declinedAt = declinedAt;
      row.updatedAt = declinedAt;
    },
    async acceptCreateUserAndMembership(input) {
      const row = invites.get(input.inviteId);
      if (
        !row ||
        row.acceptedAt ||
        row.declinedAt ||
        row.expiresAt.getTime() <= input.acceptedAt.getTime()
      ) {
        throw new InvalidStateError("Invite is no longer pending");
      }
      if (registeredEmails.has(input.email)) {
        throw new ConflictError("Email already registered");
      }
      registeredEmails.add(input.email);
      row.acceptedAt = input.acceptedAt;
      row.updatedAt = input.acceptedAt;
      return { userId: randomUUID(), membershipId: randomUUID() };
    },
    async findOrgName() {
      return "Acme Stock";
    },
    async emailRegistered(email) {
      return registeredEmails.has(email.toLowerCase());
    },
  };

  const opaqueTokens: OpaqueTokenService = {
    issue() {
      tokenSeq += 1;
      return `invite-raw-${tokenSeq}`;
    },
    hash(rawToken) {
      return `sha:${rawToken}`;
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

  const mailer: Mailer = {
    async send(message) {
      mailLog.push(message);
    },
  };

  const notifications: EnqueueNotificationIntent = {
    async enqueue(intent) {
      notificationLog.push(intent);
    },
  };

  const deps: MembershipInviteDeps = {
    invites: store,
    passwords,
    opaqueTokens,
    mailer,
    notifications,
    clock: { now: () => now },
    config: {
      inviteTtlSeconds: 7 * 24 * 60 * 60,
      appPublicUrl: "http://localhost:5173",
    },
  };

  const useCases = new MembershipInviteUseCases(deps);

  return {
    useCases,
    mailLog,
    notificationLog,
    rawByInviteId,
    rememberToken(inviteId: string, token: string) {
      rawByInviteId.set(inviteId, token);
    },
  };
}

async function buildApp(
  useCases: MembershipInviteUseCases,
  membershipAccess?: MembershipAccessPort,
) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(requestIdPlugin);
  await app.register(
    membershipAccess
      ? createTestContextPluginWith(membershipAccess)
      : createTestContextPlugin(),
  );
  await app.register(membershipInviteRoutes(useCases), { prefix: "/api/v1" });
  return app;
}

describe("membershipInviteRoutes", () => {
  const apps: { close(): Promise<void> }[] = [];

  afterEach(async () => {
    while (apps.length) {
      const app = apps.pop();
      if (app) await app.close();
    }
  });

  it("admin creates invite then accept/decline via token (API lifecycle)", async () => {
    const harness = createInviteHarness();
    const app = await buildApp(harness.useCases);
    apps.push(app);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/membership-invites",
      headers: {
        "content-type": "application/json",
        "x-org-id": ORG_ID,
        "x-user-id": ADMIN_USER,
      },
      payload: {
        email: "teammate@example.com",
        role: "warehouse",
        branchIds: [],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      id: string;
      email: string;
      role: string;
    };
    expect(created.email).toBe("teammate@example.com");
    expect(created.role).toBe("warehouse");
    expect(harness.mailLog).toHaveLength(0);
    expect(
      harness.notificationLog.some(
        (n) => n.eventType === "membership.invite_received",
      ),
    ).toBe(true);

    const token = "invite-raw-1";

    const acceptRes = await app.inject({
      method: "POST",
      url: "/api/v1/membership-invites/accept",
      headers: { "content-type": "application/json" },
      payload: {
        token,
        name: "Teammate",
        password: "password12",
      },
    });
    expect(acceptRes.statusCode).toBe(201);
    const accepted = acceptRes.json() as {
      inviteId: string;
      userId: string;
      email: string;
    };
    expect(accepted.inviteId).toBe(created.id);
    expect(accepted.email).toBe("teammate@example.com");
    expect(
      harness.notificationLog.some(
        (n) => n.eventType === "membership.invite_accepted",
      ),
    ).toBe(true);
  });

  it("declines invite via public token endpoint", async () => {
    const harness = createInviteHarness();
    const app = await buildApp(harness.useCases);
    apps.push(app);

    await app.inject({
      method: "POST",
      url: "/api/v1/membership-invites",
      headers: {
        "content-type": "application/json",
        "x-org-id": ORG_ID,
        "x-user-id": ADMIN_USER,
      },
      payload: { email: "nope@example.com", role: "purchasing" },
    });

    const declineRes = await app.inject({
      method: "POST",
      url: "/api/v1/membership-invites/decline",
      headers: { "content-type": "application/json" },
      payload: { token: "invite-raw-1" },
    });
    expect(declineRes.statusCode).toBe(204);
    expect(
      harness.notificationLog.some(
        (n) => n.eventType === "membership.invite_declined",
      ),
    ).toBe(true);
  });

  it("forbids non-admin create", async () => {
    const harness = createInviteHarness();
    const warehouseAccess: MembershipAccessPort = {
      findActiveByUser: async (orgId, userId) => ({
        id: randomUUID(),
        orgId,
        userId,
        role: "warehouse",
        status: "active",
        branchIds: ["33333333-3333-4333-8333-333333333333"],
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    };
    const app = await buildApp(harness.useCases, warehouseAccess);
    apps.push(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/membership-invites",
      headers: {
        "content-type": "application/json",
        "x-org-id": ORG_ID,
        "x-user-id": ADMIN_USER,
      },
      payload: { email: "x@example.com", role: "warehouse" },
    });
    expect(res.statusCode).toBe(403);
  });
});
