import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";
import type { ApprovalPolicyPort } from "../ports/approval-policy.js";
import { ApprovalPolicyUseCases } from "./approval-policy.js";

/** In-memory ApprovalPolicyPort for application tests. */
export function createFakeApprovalPolicyPort(
  seed?: Array<{
    orgId: string;
    documentType: ApprovalDocumentType;
    required: boolean;
  }>,
): ApprovalPolicyPort {
  const rows = new Map<string, ApprovalPolicy>();
  const key = (orgId: string, documentType: ApprovalDocumentType) =>
    `${orgId}:${documentType}`;
  for (const row of seed ?? []) {
    rows.set(key(row.orgId, row.documentType), {
      id: `pol-${row.documentType}`,
      orgId: row.orgId,
      documentType: row.documentType,
      required: row.required,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
      updatedAt: new Date("2026-07-26T00:00:00.000Z"),
    });
  }
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

/** Both document types with required=false — legacy posts of draft/submitted still work. */
export function createPermissiveApprovalPolicies(
  orgId = "org-1",
): ApprovalPolicyUseCases {
  return new ApprovalPolicyUseCases(
    createFakeApprovalPolicyPort([
      { orgId, documentType: "purchase_order", required: false },
      { orgId, documentType: "stock_adjustment", required: false },
    ]),
  );
}
