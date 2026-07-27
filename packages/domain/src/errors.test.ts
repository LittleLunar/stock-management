import { describe, expect, it } from "vitest";
import {
  EmailNotVerifiedError,
  InvalidCredentialsError,
  NotFoundError,
  TokenExpiredError,
  TokenInvalidError,
  UnauthorizedError,
} from "./errors.js";

describe("domain errors", () => {
  it("NotFoundError uses NOT_FOUND code", () => {
    const err = new NotFoundError("Branch");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Branch not found");
  });

  it("UnauthorizedError defaults message", () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("InvalidCredentialsError uses INVALID_CREDENTIALS", () => {
    const err = new InvalidCredentialsError();
    expect(err.code).toBe("INVALID_CREDENTIALS");
    expect(err.message).toBe("Invalid email or password");
  });

  it("EmailNotVerifiedError uses EMAIL_NOT_VERIFIED", () => {
    const err = new EmailNotVerifiedError();
    expect(err.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("TokenExpiredError uses TOKEN_EXPIRED", () => {
    const err = new TokenExpiredError();
    expect(err.code).toBe("TOKEN_EXPIRED");
  });

  it("TokenInvalidError uses TOKEN_INVALID", () => {
    const err = new TokenInvalidError();
    expect(err.code).toBe("TOKEN_INVALID");
  });
});
