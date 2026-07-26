import { describe, expect, it } from "vitest";
import { assertTransferPurpose } from "./inventory-rules.js";
import { InvalidStateError } from "./errors.js";

describe("assertTransferPurpose", () => {
  it("allows standard same-branch", () => {
    expect(() =>
      assertTransferPurpose("standard", "b1", "b1"),
    ).not.toThrow();
  });

  it("allows standard cross-branch", () => {
    expect(() =>
      assertTransferPurpose("standard", "b1", "b2"),
    ).not.toThrow();
  });

  it("allows replenishment cross-branch", () => {
    expect(() =>
      assertTransferPurpose("replenishment", "hq", "store"),
    ).not.toThrow();
  });

  it("rejects replenishment same-branch", () => {
    expect(() =>
      assertTransferPurpose("replenishment", "b1", "b1"),
    ).toThrow(InvalidStateError);
  });
});
