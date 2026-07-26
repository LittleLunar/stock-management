import { describe, expect, it } from "vitest";
import { UsersUseCases } from "./users.js";
import type { UsersRepository } from "../ports/repositories.js";
import type { Membership, User } from "@stock-management/domain";

function mem(partial: Partial<Membership> & Pick<Membership, "id" | "branchIds">): Membership {
  return {
    orgId: "org-1",
    userId: "user-1",
    role: "warehouse",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...partial,
  };
}

describe("UsersUseCases membership branchIds", () => {
  it("listMemberships returns branchIds from repo", async () => {
    const repo: UsersRepository = {
      listUsers: async () => [],
      createUser: async () => null as unknown as User,
      listMemberships: async () => [mem({ id: "m1", branchIds: ["b1"] })],
      createMembership: async () => mem({ id: "m1", branchIds: ["b1"] }),
      findMembership: async () => mem({ id: "m1", branchIds: ["b1"] }),
    };
    const uc = new UsersUseCases(repo);
    const rows = await uc.listMemberships("org-1");
    expect(rows[0]?.branchIds).toEqual(["b1"]);
  });
});
