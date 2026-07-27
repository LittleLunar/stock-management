import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";

export interface ApprovalPolicyPort {
  list(orgId: string): Promise<ApprovalPolicy[]>;
  findByDocumentType(
    orgId: string,
    documentType: ApprovalDocumentType,
  ): Promise<ApprovalPolicy | null>;
  upsert(
    orgId: string,
    documentType: ApprovalDocumentType,
    required: boolean,
  ): Promise<ApprovalPolicy>;
}
