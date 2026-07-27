import { describe, expect, it } from "vitest";
import {
  assertCanPostAdjustment,
  InvalidStateError,
  type ApprovalDocumentType,
  type ApprovalPolicy,
  type StockAdjustment,
} from "@stock-management/domain";
import type { ApprovalPolicyPort } from "../ports/approval-policy.js";
import type { StockAdjustmentPort } from "../ports/inventory.js";
import { ApprovalPolicyUseCases } from "./approval-policy.js";
import { StockAdjustmentUseCases } from "./stock-adjustment.js";

const now = new Date("2026-07-26T12:00:00.000Z");

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

function createAdjustment(
  status: StockAdjustment["status"],
): StockAdjustment & { lines: [] } {
  return {
    id: "adj-1",
    orgId: "org-1",
    branchId: "branch-1",
    locationId: "loc-1",
    documentNumber: null,
    reasonCode: "count",
    reasonNote: null,
    status,
    createdAt: now,
    updatedAt: now,
    postedAt: null,
    voidedAt: null,
    lines: [],
  };
}

function createAdjPort(
  initial: StockAdjustment & { lines: [] },
): StockAdjustmentPort {
  let current = initial;
  return {
    async list() {
      return [current];
    },
    async findById(_orgId, id) {
      return id === current.id ? current : null;
    },
    async create() {
      return current;
    },
    async update() {
      return current;
    },
    async updateStatus(_orgId, id, status, occurredAt) {
      if (id !== current.id) throw new Error("missing adjustment");
      current = {
        ...current,
        status,
        postedAt:
          status === "posted" ? (occurredAt ?? now) : current.postedAt,
        updatedAt: now,
      };
      return current;
    },
  };
}

describe("StockAdjustment approval lifecycle", () => {
  it("submit draft → pending_approval", async () => {
    const port = createAdjPort(createAdjustment("draft"));
    const uc = new StockAdjustmentUseCases(port);
    const result = await uc.submitForApproval("org-1", "adj-1");
    expect(result.status).toBe("pending_approval");
  });

  it("approve pending_approval → approved", async () => {
    const port = createAdjPort(createAdjustment("pending_approval"));
    const uc = new StockAdjustmentUseCases(port);
    const result = await uc.approve("org-1", "adj-1");
    expect(result.status).toBe("approved");
  });

  it("post rejects draft when policy required", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "stock_adjustment", true);
    const adj = createAdjustment("draft");
    const required = await policies.getRequired("org-1", "stock_adjustment");
    expect(() => assertCanPostAdjustment(adj, { required })).toThrow(
      InvalidStateError,
    );
    expect(() => assertCanPostAdjustment(adj, { required })).toThrow(
      /approval required/i,
    );
  });

  it("post allows draft when policy not required", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "stock_adjustment", false);
    const adj = createAdjustment("draft");
    const required = await policies.getRequired("org-1", "stock_adjustment");
    expect(() => assertCanPostAdjustment(adj, { required })).not.toThrow();
  });

  it("post allows approved when policy required", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "stock_adjustment", true);
    const adj = createAdjustment("approved");
    const required = await policies.getRequired("org-1", "stock_adjustment");
    expect(() => assertCanPostAdjustment(adj, { required })).not.toThrow();
  });
});
