import { randomUUID } from "node:crypto";
import {
  ConflictError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenInvalidError,
  UnauthorizedError,
} from "@stock-management/domain";
import type {
  AuthDeps,
  AuthSession,
  EmailTokenPurpose,
  MeResult,
  SignupResult,
} from "../ports/auth.js";

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export class AuthUseCases {
  constructor(private readonly deps: AuthDeps) {}

  async signup(input: {
    email: string;
    password: string;
    name: string;
    orgName: string;
  }): Promise<SignupResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await this.deps.passwords.hash(input.password);
    const created = await this.deps.users.createSignup({
      email,
      name: input.name,
      passwordHash,
      orgName: input.orgName,
    });

    await this.issueEmailTokenAndSend({
      userId: created.userId,
      email,
      purpose: "verify_email",
      ttlSeconds: this.deps.config.emailVerifyTtlSeconds,
      subject: "Verify your email",
      path: "/verify-email",
    });

    return created;
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);
    if (!user?.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const ok = await this.deps.passwords.verify(
      input.password,
      user.passwordHash,
    );
    if (!ok) {
      throw new InvalidCredentialsError();
    }

    if (!user.emailVerifiedAt) {
      throw new EmailNotVerifiedError();
    }

    return this.createSession(user.id, user.email);
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    const hash = this.deps.opaqueTokens.hash(input.refreshToken);
    const row = await this.deps.refreshTokens.findByTokenHash(hash);
    if (!row) return;
    await this.deps.refreshTokens.revokeFamily(
      row.familyId,
      this.deps.clock.now(),
    );
  }

  async refresh(input: { refreshToken: string }): Promise<AuthSession> {
    const now = this.deps.clock.now();
    const hash = this.deps.opaqueTokens.hash(input.refreshToken);
    const row = await this.deps.refreshTokens.findByTokenHash(hash);
    if (!row) {
      throw new TokenInvalidError();
    }

    if (row.revokedAt) {
      await this.deps.refreshTokens.revokeFamily(row.familyId, now);
      throw new TokenInvalidError("Refresh token reuse detected");
    }

    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.deps.refreshTokens.revoke(row.id, now);
      throw new TokenExpiredError();
    }

    const user = await this.deps.users.findById(row.userId);
    if (!user) {
      throw new TokenInvalidError();
    }

    await this.deps.refreshTokens.revoke(row.id, now);

    return this.createSession(user.id, user.email, row.familyId);
  }

  async verifyEmail(input: { token: string }): Promise<void> {
    const record = await this.consumeEmailToken(
      input.token,
      "verify_email",
    );
    await this.deps.users.setEmailVerified(
      record.userId,
      this.deps.clock.now(),
    );
  }

  async resendVerification(input: { email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return;
    }

    await this.deps.emailTokens.invalidateUnused(user.id, "verify_email");
    await this.issueEmailTokenAndSend({
      userId: user.id,
      email,
      purpose: "verify_email",
      ttlSeconds: this.deps.config.emailVerifyTtlSeconds,
      subject: "Verify your email",
      path: "/verify-email",
    });
  }

  async forgotPassword(input: { email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);
    if (!user) {
      return;
    }

    await this.deps.emailTokens.invalidateUnused(user.id, "reset_password");
    await this.issueEmailTokenAndSend({
      userId: user.id,
      email,
      purpose: "reset_password",
      ttlSeconds: this.deps.config.passwordResetTtlSeconds,
      subject: "Reset your password",
      path: "/reset-password",
    });
  }

  async resetPassword(input: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    const record = await this.consumeEmailToken(
      input.token,
      "reset_password",
    );
    const passwordHash = await this.deps.passwords.hash(input.newPassword);
    await this.deps.users.updatePasswordHash(record.userId, passwordHash);
    await this.deps.refreshTokens.revokeAllForUser(
      record.userId,
      this.deps.clock.now(),
    );
  }

  async getMe(input: { userId: string }): Promise<MeResult> {
    const user = await this.deps.users.findById(input.userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    const memberships = await this.deps.users.listMembershipsForUser(user.id);
    return { user: safeUser, memberships };
  }

  private async createSession(
    userId: string,
    email: string,
    familyId: string = randomUUID(),
  ): Promise<AuthSession> {
    const now = this.deps.clock.now();
    const accessToken = await this.deps.accessTokens.sign({
      sub: userId,
      email,
    });
    const refreshToken = this.deps.opaqueTokens.issue();
    const refreshExpiresAt = addSeconds(
      now,
      this.deps.config.refreshTokenTtlSeconds,
    );
    await this.deps.refreshTokens.insert({
      userId,
      tokenHash: this.deps.opaqueTokens.hash(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    });
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      userId,
      email,
    };
  }

  private async issueEmailTokenAndSend(input: {
    userId: string;
    email: string;
    purpose: EmailTokenPurpose;
    ttlSeconds: number;
    subject: string;
    path: string;
  }): Promise<void> {
    const now = this.deps.clock.now();
    const raw = this.deps.opaqueTokens.issue();
    await this.deps.emailTokens.insert({
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: this.deps.opaqueTokens.hash(raw),
      expiresAt: addSeconds(now, input.ttlSeconds),
    });
    const link = `${this.deps.config.appPublicUrl}${input.path}?token=${encodeURIComponent(raw)}`;
    await this.deps.mailer.send({
      to: input.email,
      subject: input.subject,
      text: `Open this link to continue: ${link}`,
      html: `<p><a href="${link}">${input.subject}</a></p>`,
    });
  }

  private async consumeEmailToken(
    rawToken: string,
    purpose: EmailTokenPurpose,
  ) {
    const now = this.deps.clock.now();
    const hash = this.deps.opaqueTokens.hash(rawToken);
    const row = await this.deps.emailTokens.findByTokenHash(hash, purpose);
    if (!row || row.usedAt) {
      throw new TokenInvalidError();
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      throw new TokenExpiredError();
    }
    await this.deps.emailTokens.markUsed(row.id, now);
    return row;
  }
}
