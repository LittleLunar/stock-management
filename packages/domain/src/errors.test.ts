import { describe, expect, it } from "vitest";
import { NotFoundError, UnauthorizedError } from "./errors.js";

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
});
