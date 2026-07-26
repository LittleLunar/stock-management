import { describe, expect, it } from "vitest";
import {
  ErrorEnvelopeSchema,
  isErrorEnvelope,
} from "./errors.js";

describe("ErrorEnvelopeSchema", () => {
  it("accepts a valid envelope with requestId", () => {
    const payload = {
      error: {
        code: "NOT_FOUND",
        message: "Branch not found",
        requestId: "req-123",
      },
    };
    expect(ErrorEnvelopeSchema.parse(payload)).toEqual(payload);
    expect(isErrorEnvelope(payload)).toBe(true);
  });

  it("accepts optional details", () => {
    const payload = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { fieldErrors: { code: ["Required"] } },
        requestId: "abc",
      },
    };
    expect(ErrorEnvelopeSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects missing requestId", () => {
    const result = ErrorEnvelopeSchema.safeParse({
      error: { code: "INTERNAL_ERROR", message: "boom" },
    });
    expect(result.success).toBe(false);
    expect(isErrorEnvelope({ error: { code: "x", message: "y" } })).toBe(false);
  });
});
