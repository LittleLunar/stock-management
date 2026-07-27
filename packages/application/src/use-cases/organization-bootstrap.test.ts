import { describe, expect, it, vi } from "vitest";
import type { Organization } from "@stock-management/domain";
import type { OrganizationRepository } from "../ports/repositories.js";
import { OrganizationUseCases } from "./organization.js";

const ownerId = "00000000-0000-0000-0000-000000000001";

function org(partial?: Partial<Organization>): Organization {
  return {
    id: "org-1",
    name: "Demo Shop",
    currency: "THB",
    timezone: "Asia/Bangkok",
    fiscalYearStartMonth: 1,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...partial,
  };
}

describe("OrganizationUseCases.createWithOwner", () => {
  it("delegates to repo.createWithOwner with creator userId", async () => {
    const created = org();
    const createWithOwner = vi.fn(async () => created);
    const repo: OrganizationRepository = {
      findById: async () => null,
      update: async () => null,
      create: async () => created,
      createWithOwner,
    };
    const uc = new OrganizationUseCases(repo);
    const input = { name: "Demo Shop" };
    const result = await uc.createWithOwner(input, {
      userId: ownerId,
      email: "admin@local",
      name: "Admin",
    });
    expect(result).toEqual(created);
    expect(createWithOwner).toHaveBeenCalledWith(input, {
      userId: ownerId,
      email: "admin@local",
      name: "Admin",
    });
  });
});
