import { describe, expect, it } from "vitest";
import {
  assertBranchAccess,
  canPerform,
  resolveActiveBranch,
} from "./access.js";
import { ForbiddenError } from "./errors.js";

const branchUser = {
  role: "warehouse" as const,
  branchIds: ["b1", "b2"],
};
const hq = { role: "org_admin" as const, branchIds: [] as string[] };

describe("assertBranchAccess", () => {
  it("allows HQ any branch", () => {
    expect(() => assertBranchAccess(hq, "b99")).not.toThrow();
  });
  it("allows granted branch", () => {
    expect(() => assertBranchAccess(branchUser, "b1")).not.toThrow();
  });
  it("rejects ungranted branch", () => {
    expect(() => assertBranchAccess(branchUser, "b99")).toThrow(ForbiddenError);
  });
});

describe("resolveActiveBranch", () => {
  it("HQ omit → null", () => {
    expect(resolveActiveBranch(hq, null)).toBeNull();
    expect(resolveActiveBranch(hq, undefined)).toBeNull();
  });
  it("HQ set → that branch", () => {
    expect(resolveActiveBranch(hq, "b3")).toBe("b3");
  });
  it("branch omit → first grant", () => {
    expect(resolveActiveBranch(branchUser, null)).toBe("b1");
  });
  it("branch set granted → that branch", () => {
    expect(resolveActiveBranch(branchUser, "b2")).toBe("b2");
  });
  it("branch set ungranted → ForbiddenError", () => {
    expect(() => resolveActiveBranch(branchUser, "b9")).toThrow(ForbiddenError);
  });
});

describe("canPerform", () => {
  it("warehouse can inventory.post but not po.write", () => {
    expect(canPerform("warehouse", "inventory.post")).toBe(true);
    expect(canPerform("warehouse", "po.write")).toBe(false);
  });
  it("purchasing can po.write but not inventory.post", () => {
    expect(canPerform("purchasing", "po.write")).toBe(true);
    expect(canPerform("purchasing", "inventory.post")).toBe(false);
  });
  it("accountant can accounting.read only among write actions", () => {
    expect(canPerform("accountant", "accounting.read")).toBe(true);
    expect(canPerform("accountant", "inventory.post")).toBe(false);
    expect(canPerform("accountant", "masters.write")).toBe(false);
  });
  it("org_admin can all E1 actions", () => {
    for (const a of [
      "masters.write",
      "inventory.post",
      "po.write",
      "accounting.read",
    ] as const) {
      expect(canPerform("org_admin", a)).toBe(true);
    }
  });

  it("document.approve is org_admin and branch_manager only", () => {
    expect(canPerform("org_admin", "document.approve")).toBe(true);
    expect(canPerform("branch_manager", "document.approve")).toBe(true);
    expect(canPerform("warehouse", "document.approve")).toBe(false);
    expect(canPerform("purchasing", "document.approve")).toBe(false);
    expect(canPerform("accountant", "document.approve")).toBe(false);
  });
});

describe("canPerform webhook.admin", () => {
  it("allows org_admin only", () => {
    expect(canPerform("org_admin", "webhook.admin")).toBe(true);
    expect(canPerform("branch_manager", "webhook.admin")).toBe(false);
    expect(canPerform("warehouse", "webhook.admin")).toBe(false);
    expect(canPerform("purchasing", "webhook.admin")).toBe(false);
    expect(canPerform("accountant", "webhook.admin")).toBe(false);
  });
});
