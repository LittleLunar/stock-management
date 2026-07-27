import { describe, expect, it } from "vitest";
import {
  authEmailTokenPurposeEnum,
  authEmailTokens,
  authRefreshTokens,
  membershipInvites,
  users,
} from "./index.js";

describe("auth schema", () => {
  it("extends users with password_hash and email_verified_at", () => {
    expect(users.passwordHash).toBeDefined();
    expect(users.emailVerifiedAt).toBeDefined();
  });

  it("exposes auth_email_token_purpose enum", () => {
    expect(authEmailTokenPurposeEnum.enumValues).toEqual([
      "verify_email",
      "reset_password",
    ]);
  });

  it("defines auth_refresh_tokens with family rotation fields", () => {
    expect(authRefreshTokens.userId).toBeDefined();
    expect(authRefreshTokens.tokenHash).toBeDefined();
    expect(authRefreshTokens.familyId).toBeDefined();
    expect(authRefreshTokens.expiresAt).toBeDefined();
    expect(authRefreshTokens.revokedAt).toBeDefined();
  });

  it("defines auth_email_tokens with purpose and used_at", () => {
    expect(authEmailTokens.userId).toBeDefined();
    expect(authEmailTokens.purpose).toBeDefined();
    expect(authEmailTokens.tokenHash).toBeDefined();
    expect(authEmailTokens.expiresAt).toBeDefined();
    expect(authEmailTokens.usedAt).toBeDefined();
  });
});

describe("membership_invites schema", () => {
  it("defines invite lifecycle columns", () => {
    expect(membershipInvites.orgId).toBeDefined();
    expect(membershipInvites.email).toBeDefined();
    expect(membershipInvites.role).toBeDefined();
    expect(membershipInvites.branchIds).toBeDefined();
    expect(membershipInvites.tokenHash).toBeDefined();
    expect(membershipInvites.invitedBy).toBeDefined();
    expect(membershipInvites.expiresAt).toBeDefined();
    expect(membershipInvites.acceptedAt).toBeDefined();
    expect(membershipInvites.declinedAt).toBeDefined();
  });
});
