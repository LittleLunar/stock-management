import type { MembershipRole } from "@stock-management/domain";
import type { Mailer, OpaqueTokenService, PasswordHasher } from "./auth.js";

export type MembershipInviteRecord = {
  id: string;
  orgId: string;
  email: string;
  role: MembershipRole;
  branchIds: string[];
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipInviteCreated = {
  id: string;
  orgId: string;
  email: string;
  role: MembershipRole;
  branchIds: string[];
  expiresAt: Date;
  /** Raw token — only returned from create for mailer/tests; never persisted. */
  token: string;
};

export type MembershipInviteAccepted = {
  inviteId: string;
  userId: string;
  membershipId: string;
  orgId: string;
  email: string;
};

export type NotificationIntentEventType =
  | "membership.invite_received"
  | "membership.invite_accepted"
  | "membership.invite_declined";

export type NotificationIntent = {
  eventType: NotificationIntentEventType;
  orgId: string;
  actorId: string;
  entityRef: { type: "membership_invite"; id: string };
  recipientHints?: { email?: string; userId?: string };
  payload?: Record<string, unknown>;
};

/** Stub-ready port; Task 6 wires outbox dispatch. */
export interface EnqueueNotificationIntent {
  enqueue(intent: NotificationIntent): Promise<void>;
}

export class NoOpEnqueueNotificationIntent implements EnqueueNotificationIntent {
  async enqueue(_intent: NotificationIntent): Promise<void> {}
}

export interface MembershipInviteStore {
  insert(input: {
    orgId: string;
    email: string;
    role: MembershipRole;
    branchIds: string[];
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<MembershipInviteRecord>;

  findByTokenHash(tokenHash: string): Promise<MembershipInviteRecord | null>;

  findPendingByOrgEmail(
    orgId: string,
    email: string,
  ): Promise<MembershipInviteRecord | null>;

  /** Soft-cancel unused pending invites for org+email (sets declinedAt). */
  cancelPendingByOrgEmail(
    orgId: string,
    email: string,
    at: Date,
  ): Promise<void>;

  /**
   * Atomically mark declined only if still pending and not expired.
   * @throws InvalidStateError if already finalized or expired
   */
  markDeclined(id: string, declinedAt: Date): Promise<void>;

  /**
   * Claim invite (pending + unexpired) then create invitee user + membership
   * in one transaction. Email is treated as verified via the invite token.
   * @throws InvalidStateError if invite already finalized or expired
   */
  acceptCreateUserAndMembership(input: {
    inviteId: string;
    orgId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: MembershipRole;
    branchIds: string[];
    acceptedAt: Date;
  }): Promise<{ userId: string; membershipId: string }>;

  findOrgName(orgId: string): Promise<string | null>;

  emailRegistered(email: string): Promise<boolean>;
}

export type MembershipInviteClock = {
  now(): Date;
};

export type MembershipInviteConfig = {
  inviteTtlSeconds: number;
  appPublicUrl: string;
};

export type MembershipInviteDeps = {
  invites: MembershipInviteStore;
  passwords: PasswordHasher;
  opaqueTokens: OpaqueTokenService;
  mailer: Mailer;
  notifications: EnqueueNotificationIntent;
  clock: MembershipInviteClock;
  config: MembershipInviteConfig;
};
