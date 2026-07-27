import type { Membership, MembershipRole, MasterStatus } from "@stock-management/domain";

export type EmailTokenPurpose = "verify_email" | "reset_password";

export type AuthUserRecord = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  status: MasterStatus;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthMembershipRecord = {
  id: string;
  orgId: string;
  orgName: string;
  userId: string;
  role: MembershipRole;
  status: MasterStatus;
  branchIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type EmailTokenRecord = {
  id: string;
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type SignupResult = {
  userId: string;
  orgId: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  userId: string;
  email: string;
};

export type MeResult = {
  user: Omit<AuthUserRecord, "passwordHash">;
  memberships: AuthMembershipRecord[];
};

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface AccessTokenSigner {
  sign(claims: { sub: string; email: string }): Promise<string>;
  verify(token: string): Promise<{ sub: string; email: string }>;
}

/** Issues opaque raw tokens and hashes them for storage. */
export interface OpaqueTokenService {
  issue(): string;
  hash(rawToken: string): string;
}

export interface RefreshTokenStore {
  insert(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}

export interface EmailTokenStore {
  insert(input: {
    userId: string;
    purpose: EmailTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailTokenRecord>;
  findByTokenHash(
    tokenHash: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
  invalidateUnused(userId: string, purpose: EmailTokenPurpose): Promise<void>;
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface AuthUserStore {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  /** Create org + user + HQ org_admin membership in one transaction. */
  createSignup(input: {
    email: string;
    name: string;
    passwordHash: string;
    orgName: string;
  }): Promise<SignupResult>;
  setEmailVerified(userId: string, at: Date): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  listMembershipsForUser(userId: string): Promise<AuthMembershipRecord[]>;
}

export type AuthClock = {
  now(): Date;
};

export type AuthConfig = {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  emailVerifyTtlSeconds: number;
  passwordResetTtlSeconds: number;
  appPublicUrl: string;
};

export type AuthDeps = {
  users: AuthUserStore;
  passwords: PasswordHasher;
  accessTokens: AccessTokenSigner;
  opaqueTokens: OpaqueTokenService;
  refreshTokens: RefreshTokenStore;
  emailTokens: EmailTokenStore;
  mailer: Mailer;
  clock: AuthClock;
  config: AuthConfig;
};

/** Re-export Membership for GetMe consumers that need the domain shape. */
export type { Membership };
