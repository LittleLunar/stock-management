import { describe, expect, it } from "vitest";
import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";
import type { ApprovalPolicyPort } from "../ports/approval-policy.js";
import { ApprovalPolicyUseCases } from "./approval-policy.js";

function createFakeApprovalPolicyPort(): ApprovalPolicyPort {
  const rows = new Map<string, ApprovalPolicy>();
  const key = (orgId: string, documentType: ApprovalDocumentType) =>
    `${orgId}:${documentType}`;
  return {
    async list(orgId) {
      return [...rows.values()].filter((r) => r.orgId === orgId);
    },
    async findByDocumentType(orgId, documentType) {
      return rows.get(key(orgId, documentType)) ?? null;
    },
    async upsert(orgId, documentType, required) {
      const id = key(orgId, documentType);
      const existing = rows.get(id);
      const row: ApprovalPolicy = {
        id: existing?.id ?? `pol-${documentType}`,
        orgId,
        documentType,
        required,
        createdAt: existing?.createdAt ?? new Date("2026-07-26T00:00:00.000Z"),
        updatedAt: new Date("2026-07-26T12:00:00.000Z"),
      };
      rows.set(id, row);
      return row;
    },
  };
}

describe("ApprovalPolicyUseCases", () => {
  it("ensureDefaults seeds both types as required", async () => {
    const uc = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    const list = await uc.list("org-1");
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.documentType).sort()).toEqual([
      "purchase_order",
      "stock_adjustment",
    ]);
    expect(list.every((p) => p.required)).toBe(true);
  });

  it("upsert flips required", async () => {
    const uc = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    const row = await uc.upsert("org-1", "purchase_order", false);
    expect(row.required).toBe(false);
    expect(await uc.getRequired("org-1", "purchase_order")).toBe(false);
  });
});
