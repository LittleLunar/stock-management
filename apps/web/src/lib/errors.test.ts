import { describe, expect, it, beforeEach } from "vitest";
import i18n, { setLocale } from "../i18n";
import { ApiError, formatApiError } from "./errors.js";

describe("formatApiError i18n", () => {
  beforeEach(async () => {
    await setLocale("en");
  });

  it("maps known codes to English messages", () => {
    const err = new ApiError(404, {
      code: "NOT_FOUND",
      message: "Product not found",
      requestId: "unknown",
    });
    expect(formatApiError(err)).toBe("Not found");
  });

  it("maps known codes to Thai when locale is th", async () => {
    await setLocale("th");
    const err = new ApiError(409, {
      code: "INSUFFICIENT_STOCK",
      message: "Insufficient stock",
      requestId: "unknown",
    });
    expect(formatApiError(err)).toBe(
      i18n.t("errors.INSUFFICIENT_STOCK", { ns: "errors" }),
    );
  });

  it("falls back to server message for unknown codes", () => {
    const err = new ApiError(400, {
      code: "SOME_NEW_CODE",
      message: "Custom server message",
      requestId: "unknown",
    });
    expect(formatApiError(err)).toBe("Custom server message");
  });
});
