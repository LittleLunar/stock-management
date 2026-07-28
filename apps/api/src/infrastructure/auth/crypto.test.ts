import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { TokenExpiredError, TokenInvalidError } from "@stock-management/domain";
import {
  Argon2PasswordHasher,
  JoseAccessTokenSigner,
  Sha256OpaqueTokenService,
} from "./crypto.js";
import { ConsoleMailer, createMailer } from "./mailer.js";

describe("auth crypto adapters", () => {
  it("Argon2PasswordHasher hashes and verifies", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("s3cret");
    expect(hash).not.toBe("s3cret");
    expect(await hasher.verify("s3cret", hash)).toBe(true);
    expect(await hasher.verify("wrong", hash)).toBe(false);
  });

  it("Sha256OpaqueTokenService issues unique opaque tokens", () => {
    const tokens = new Sha256OpaqueTokenService();
    const a = tokens.issue();
    const b = tokens.issue();
    expect(a).not.toBe(b);
    expect(tokens.hash(a)).toHaveLength(64);
    expect(tokens.hash(a)).toBe(tokens.hash(a));
  });

  it("JoseAccessTokenSigner round-trips claims", async () => {
    const signer = new JoseAccessTokenSigner("test-secret-key", 900);
    const token = await signer.sign({
      sub: "user-1",
      email: "a@example.com",
    });
    const claims = await signer.verify(token);
    expect(claims).toEqual({ sub: "user-1", email: "a@example.com" });
  });

  it("JoseAccessTokenSigner maps expired JWT to TokenExpiredError", async () => {
    const secret = new TextEncoder().encode("test-secret-key");
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ email: "a@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(secret);
    const signer = new JoseAccessTokenSigner("test-secret-key", 900);
    await expect(signer.verify(token)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("JoseAccessTokenSigner maps malformed JWT to TokenInvalidError", async () => {
    const signer = new JoseAccessTokenSigner("test-secret-key", 900);
    await expect(signer.verify("not-a-jwt")).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
  });
});

describe("mailer factory", () => {
  it("defaults to ConsoleMailer when SMTP_HOST unset", () => {
    expect(createMailer({})).toBeInstanceOf(ConsoleMailer);
  });
});
