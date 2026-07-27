import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@stock-management/domain";
import { resolveRequestContext } from "./context.js";

describe("resolveRequestContext", () => {
  const membership = {
    id: "m1",
    orgId: "org-1",
    userId: "user-1",
    role: "warehouse" as const,
    status: "active" as const,
    branchIds: ["b1"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("401 when no membership", async () => {
    await expect(
      resolveRequestContext({
        orgId: "org-1",
        userId: "user-1",
        headerBranchId: null,
        findActiveByUser: async () => null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("sets activeBranchId from first grant when header omitted", async () => {
    const ctx = await resolveRequestContext({
      orgId: "org-1",
      userId: "user-1",
      headerBranchId: null,
      findActiveByUser: async () => membership,
    });
    expect(ctx).toMatchObject({
      role: "warehouse",
      branchIds: ["b1"],
      activeBranchId: "b1",
    });
  });

  it("403 when header branch not granted", async () => {
    await expect(
      resolveRequestContext({
        orgId: "org-1",
        userId: "user-1",
        headerBranchId: "b9",
        findActiveByUser: async () => membership,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("HQ org_admin gets empty branchIds and null activeBranchId", async () => {
    const ctx = await resolveRequestContext({
      orgId: "org-1",
      userId: "user-1",
      headerBranchId: null,
      findActiveByUser: async () => ({
        ...membership,
        role: "org_admin",
        branchIds: [],
      }),
    });
    expect(ctx).toMatchObject({
      role: "org_admin",
      branchIds: [],
      activeBranchId: null,
    });
  });
});
