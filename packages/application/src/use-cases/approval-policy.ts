import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";
import type { ApprovalPolicyPort } from "../ports/approval-policy.js";

export class ApprovalPolicyUseCases {
  constructor(private readonly repo: ApprovalPolicyPort) {}

  /** Ensure both document types exist with required=true; return all. */
  async list(orgId: string): Promise<ApprovalPolicy[]> {
    await this.ensureDefaults(orgId);
    return this.repo.list(orgId);
  }

  async ensureDefaults(orgId: string): Promise<void> {
    for (const documentType of [
      "purchase_order",
      "stock_adjustment",
    ] as const) {
      const existing = await this.repo.findByDocumentType(orgId, documentType);
      if (!existing) {
        await this.repo.upsert(orgId, documentType, true);
      }
    }
  }

  async upsert(
    orgId: string,
    documentType: ApprovalDocumentType,
    required: boolean,
  ): Promise<ApprovalPolicy> {
    await this.ensureDefaults(orgId);
    return this.repo.upsert(orgId, documentType, required);
  }

  async getRequired(
    orgId: string,
    documentType: ApprovalDocumentType,
  ): Promise<boolean> {
    await this.ensureDefaults(orgId);
    const row = await this.repo.findByDocumentType(orgId, documentType);
    return row?.required ?? true;
  }
}
