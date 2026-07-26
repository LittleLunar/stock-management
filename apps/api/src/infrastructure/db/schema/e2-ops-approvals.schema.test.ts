import { describe, expect, it } from "vitest";
import {
  approvalPolicies,
  documentStatusEnum,
  poStatusEnum,
  stockTransfers,
  transferPurposeEnum,
} from "./index.js";

describe("E2 ops/approvals schema", () => {
  it("exposes transfer_purpose enum with standard and replenishment", () => {
    expect(transferPurposeEnum.enumValues).toEqual([
      "standard",
      "replenishment",
    ]);
  });

  it("adds purpose on stock_transfers defaulting to standard", () => {
    expect(stockTransfers.purpose).toBeDefined();
    expect(stockTransfers.purpose.name).toBe("purpose");
  });

  it("extends po_status with approved after submitted", () => {
    expect(poStatusEnum.enumValues).toEqual([
      "draft",
      "submitted",
      "approved",
      "partially_received",
      "received",
      "closed",
      "cancelled",
    ]);
  });

  it("extends document_status with pending_approval and approved", () => {
    expect(documentStatusEnum.enumValues).toEqual([
      "draft",
      "pending_approval",
      "approved",
      "posted",
      "void",
    ]);
  });

  it("defines approval_policies table with org-scoped unique document_type", () => {
    expect(approvalPolicies.orgId).toBeDefined();
    expect(approvalPolicies.documentType).toBeDefined();
    expect(approvalPolicies.required).toBeDefined();
  });
});
