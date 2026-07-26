import { describe, expect, it } from "vitest";
import { branchIdForHeaders } from "./active-branch.js";

describe("branchIdForHeaders", () => {
  it("omits when All branches", () => {
    expect(branchIdForHeaders("")).toBeUndefined();
  });
  it("returns id when selected", () => {
    expect(branchIdForHeaders("b1")).toBe("b1");
  });
});
