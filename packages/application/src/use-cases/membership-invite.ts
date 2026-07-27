import {
  ConflictError,
  ForbiddenError,
  InvalidStateError,
  TokenExpiredError,
  TokenInvalidError,
  canPerform,
  type MembershipRole,
} from "@stock-management/domain";
import type {
  MembershipInviteAccepted,
  MembershipInviteCreated,
  MembershipInviteDeps,
  MembershipInviteRecord,
} from "../ports/membership-invite.js";

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function assertPending(invite: MembershipInviteRecord, now: Date): void {
  if (invite.acceptedAt) {
    throw new InvalidStateError("Invite already accepted");
  }
  if (invite.declinedAt) {
    throw new InvalidStateError("Invite already declined");
  }
  if (invite.expiresAt.getTime() <= now.getTime()) {
    throw new TokenExpiredError("Invite has expired");
  }
}

export class MembershipInviteUseCases {
  constructor(private readonly deps: MembershipInviteDeps) {}

  async createInvite(input: {
    orgId: string;
    actorUserId: string;
    actorRole: MembershipRole;
    email: string;
    role: MembershipRole;
    branchIds?: string[];
  }): Promise<MembershipInviteCreated> {
    if (!canPerform(input.actorRole, "membership.invite")) {
      throw new ForbiddenError("Only org_admin can create membership invites");
    }

    const email = input.email.trim().toLowerCase();
    const branchIds = input.branchIds ?? [];
    const now = this.deps.clock.now();

    if (await this.deps.invites.emailRegistered(email)) {
      throw new ConflictError("Email already registered");
    }

    await this.deps.invites.cancelPendingByOrgEmail(input.orgId, email, now);

    const rawToken = this.deps.opaqueTokens.issue();
    const tokenHash = this.deps.opaqueTokens.hash(rawToken);
    const expiresAt = addSeconds(now, this.deps.config.inviteTtlSeconds);

    const row = await this.deps.invites.insert({
      orgId: input.orgId,
      email,
      role: input.role,
      branchIds,
      tokenHash,
      invitedBy: input.actorUserId,
      expiresAt,
    });

    const orgName =
      (await this.deps.invites.findOrgName(input.orgId)) ?? "your organization";

    // Invite email is delivered via EmailChannelDecorator (outbox).
    // Do not put raw accept tokens / acceptUrl into the outbox payload.
    await this.deps.notifications.enqueue({
      eventType: "membership.invite_received",
      orgId: input.orgId,
      actorId: input.actorUserId,
      entityRef: { type: "membership_invite", id: row.id },
      recipientHints: { email },
      payload: {
        role: input.role,
        branchIds,
        orgName,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      id: row.id,
      orgId: row.orgId,
      email: row.email,
      role: row.role,
      branchIds: row.branchIds,
      expiresAt: row.expiresAt,
      token: rawToken,
    };
  }

  async acceptInvite(input: {
    token: string;
    name: string;
    password: string;
  }): Promise<MembershipInviteAccepted> {
    const now = this.deps.clock.now();
    const invite = await this.loadByRawToken(input.token);
    assertPending(invite, now);

    if (await this.deps.invites.emailRegistered(invite.email)) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await this.deps.passwords.hash(input.password);
    const created = await this.deps.invites.acceptCreateUserAndMembership({
      inviteId: invite.id,
      orgId: invite.orgId,
      email: invite.email,
      name: input.name.trim(),
      passwordHash,
      role: invite.role,
      branchIds: invite.branchIds,
      acceptedAt: now,
    });

    await this.deps.notifications.enqueue({
      eventType: "membership.invite_accepted",
      orgId: invite.orgId,
      actorId: created.userId,
      entityRef: { type: "membership_invite", id: invite.id },
      recipientHints: { userId: invite.invitedBy },
      payload: { inviteeUserId: created.userId, email: invite.email },
    });

    return {
      inviteId: invite.id,
      userId: created.userId,
      membershipId: created.membershipId,
      orgId: invite.orgId,
      email: invite.email,
    };
  }

  async declineInvite(input: { token: string }): Promise<{ inviteId: string }> {
    const now = this.deps.clock.now();
    const invite = await this.loadByRawToken(input.token);
    assertPending(invite, now);

    await this.deps.invites.markDeclined(invite.id, now);

    await this.deps.notifications.enqueue({
      eventType: "membership.invite_declined",
      orgId: invite.orgId,
      actorId: invite.invitedBy,
      entityRef: { type: "membership_invite", id: invite.id },
      recipientHints: { userId: invite.invitedBy },
      payload: { email: invite.email },
    });

    return { inviteId: invite.id };
  }

  private async loadByRawToken(rawToken: string): Promise<MembershipInviteRecord> {
    const hash = this.deps.opaqueTokens.hash(rawToken);
    const invite = await this.deps.invites.findByTokenHash(hash);
    if (!invite) {
      throw new TokenInvalidError("Invite token is invalid");
    }
    return invite;
  }
}
