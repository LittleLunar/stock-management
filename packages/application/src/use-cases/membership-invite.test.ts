import { randomUUID } from "node:crypto";
import {
  ConflictError,
  ForbiddenError,
  InvalidStateError,
  TokenExpiredError,
  TokenInvalidError,
} from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  AuthUserRecord,
  MailMessage,
  Mailer,
  OpaqueTokenService,
  PasswordHasher,
} from "../ports/auth.js";
import type {
  EnqueueNotificationIntent,
  MembershipInviteDeps,
  MembershipInviteRecord,
  MembershipInviteStore,
  NotificationIntent,
} from "../ports/membership-invite.js";
import { MembershipInviteUseCases } from "./membership-invite.js";

const FIXED_NOW = new Date("2026-07-27T12:00:00.000Z");
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

function createHarness(overrides?: Partial<MembershipInviteDeps>) {
  const invites = new Map<string, MembershipInviteRecord>();
  const invitesByHash = new Map<string, string>();
  const usersByEmail = new Map<string, AuthUserRecord>();
  const mailLog: MailMessage[] = [];
  const notificationLog: NotificationIntent[] = [];
  let now = new Date(FIXED_NOW);
  let tokenSeq = 0;

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
      if (usersByEmail.has(input.email)) {
        throw new ConflictError("Email already registered");
      }
      row.acceptedAt = input.acceptedAt;
      row.updatedAt = input.acceptedAt;
      const userId = randomUUID();
      const membershipId = randomUUID();
      usersByEmail.set(input.email, {
        id: userId,
        orgId: input.orgId,
        email: input.email,
        name: input.name,
        status: "active",
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.acceptedAt,
        createdAt: input.acceptedAt,
        updatedAt: input.acceptedAt,
      });
      return { userId, membershipId };
    },
    async findOrgName(orgId) {
      return orgId === ORG_ID ? "Acme Stock" : null;
    },
    async emailRegistered(email) {
      return usersByEmail.has(email.toLowerCase());
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
      return `invite-raw-${tokenSeq}`;
    },
    hash(rawToken) {
      return `sha:${rawToken}`;
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
    ...overrides,
  };

  return {
    useCases: new MembershipInviteUseCases(deps),
    store,
    mailLog,
    notificationLog,
    invites,
    usersByEmail,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    seedRegisteredEmail(email: string) {
      usersByEmail.set(email.toLowerCase(), {
        id: randomUUID(),
        orgId: ORG_ID,
        email: email.toLowerCase(),
        name: "Existing",
        status: "active",
        passwordHash: "hash:x",
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    },
  };
}

describe("MembershipInviteUseCases", () => {
  it("creates invite, emails invitee, and enqueues invite_received", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "teammate@example.com",
      role: "warehouse",
      branchIds: ["33333333-3333-4333-8333-333333333333"],
    });

    expect(created.email).toBe("teammate@example.com");
    expect(created.token).toBe("invite-raw-1");
    expect(h.mailLog).toHaveLength(1);
    expect(h.mailLog[0]?.to).toBe("teammate@example.com");
    expect(h.mailLog[0]?.text).toContain(
      "/accept-invite?token=invite-raw-1",
    );
    expect(h.notificationLog).toEqual([
      expect.objectContaining({
        eventType: "membership.invite_received",
        orgId: ORG_ID,
        actorId: ADMIN_ID,
        recipientHints: { email: "teammate@example.com" },
      }),
    ]);
  });

  it("forbids non-admin create", async () => {
    const h = createHarness();
    await expect(
      h.useCases.createInvite({
        orgId: ORG_ID,
        actorUserId: ADMIN_ID,
        actorRole: "warehouse",
        email: "x@example.com",
        role: "warehouse",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects create when email already registered", async () => {
    const h = createHarness();
    h.seedRegisteredEmail("taken@example.com");
    await expect(
      h.useCases.createInvite({
        orgId: ORG_ID,
        actorUserId: ADMIN_ID,
        actorRole: "org_admin",
        email: "taken@example.com",
        role: "purchasing",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("accepts invite: creates user+membership and enqueues invite_accepted", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "new@example.com",
      role: "accountant",
      branchIds: [],
    });

    const accepted = await h.useCases.acceptInvite({
      token: created.token,
      name: "New User",
      password: "password12",
    });

    expect(accepted.email).toBe("new@example.com");
    expect(accepted.orgId).toBe(ORG_ID);
    expect(h.usersByEmail.get("new@example.com")?.passwordHash).toBe(
      "hash:password12",
    );
    expect(h.usersByEmail.get("new@example.com")?.emailVerifiedAt).toEqual(
      FIXED_NOW,
    );
    expect(
      h.notificationLog.some((n) => n.eventType === "membership.invite_accepted"),
    ).toBe(true);

    await expect(
      h.useCases.acceptInvite({
        token: created.token,
        name: "Again",
        password: "password12",
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("declines invite and enqueues invite_declined", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "nope@example.com",
      role: "warehouse",
    });

    const declined = await h.useCases.declineInvite({ token: created.token });
    expect(declined.inviteId).toBe(created.id);
    expect(
      h.notificationLog.some((n) => n.eventType === "membership.invite_declined"),
    ).toBe(true);

    await expect(
      h.useCases.acceptInvite({
        token: created.token,
        name: "X",
        password: "password12",
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("rejects expired and invalid tokens", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "late@example.com",
      role: "warehouse",
    });

    await expect(
      h.useCases.acceptInvite({
        token: "not-a-real-token",
        name: "X",
        password: "password12",
      }),
    ).rejects.toBeInstanceOf(TokenInvalidError);

    h.advance(8 * 24 * 60 * 60 * 1000);
    await expect(
      h.useCases.declineInvite({ token: created.token }),
    ).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("atomic accept claim fails after decline without creating a user", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "race@example.com",
      role: "warehouse",
    });

    await h.store.markDeclined(created.id, FIXED_NOW);

    await expect(
      h.store.acceptCreateUserAndMembership({
        inviteId: created.id,
        orgId: ORG_ID,
        email: "race@example.com",
        name: "Race",
        passwordHash: "hash:password12",
        role: "warehouse",
        branchIds: [],
        acceptedAt: FIXED_NOW,
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    expect(h.usersByEmail.size).toBe(0);
    const row = h.invites.get(created.id);
    expect(row?.declinedAt).toEqual(FIXED_NOW);
    expect(row?.acceptedAt).toBeNull();
  });

  it("atomic decline fails after accept claim", async () => {
    const h = createHarness();
    const created = await h.useCases.createInvite({
      orgId: ORG_ID,
      actorUserId: ADMIN_ID,
      actorRole: "org_admin",
      email: "won@example.com",
      role: "accountant",
    });

    await h.store.acceptCreateUserAndMembership({
      inviteId: created.id,
      orgId: ORG_ID,
      email: "won@example.com",
      name: "Winner",
      passwordHash: "hash:password12",
      role: "accountant",
      branchIds: [],
      acceptedAt: FIXED_NOW,
    });

    await expect(
      h.store.markDeclined(created.id, FIXED_NOW),
    ).rejects.toBeInstanceOf(InvalidStateError);

    const row = h.invites.get(created.id);
    expect(row?.acceptedAt).toEqual(FIXED_NOW);
    expect(row?.declinedAt).toBeNull();
  });
});
