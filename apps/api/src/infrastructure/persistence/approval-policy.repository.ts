import { and, eq } from "drizzle-orm";
import type { ApprovalPolicyPort } from "@stock-management/application";
import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { approvalPolicies } from "../db/schema/index.js";

export class DrizzleApprovalPolicyRepository implements ApprovalPolicyPort {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<ApprovalPolicy[]> {
    return this.db
      .select()
      .from(approvalPolicies)
      .where(eq(approvalPolicies.orgId, orgId))
      .then((rows) => rows.map(toDomain));
  }

  findByDocumentType(
    orgId: string,
    documentType: ApprovalDocumentType,
  ): Promise<ApprovalPolicy | null> {
    return this.db
      .select()
      .from(approvalPolicies)
      .where(
        and(
          eq(approvalPolicies.orgId, orgId),
          eq(approvalPolicies.documentType, documentType),
        ),
      )
      .then((rows) => (rows[0] ? toDomain(rows[0]) : null));
  }

  async upsert(
    orgId: string,
    documentType: ApprovalDocumentType,
    required: boolean,
  ): Promise<ApprovalPolicy> {
    const [row] = await this.db
      .insert(approvalPolicies)
      .values({
        orgId,
        documentType,
        required,
      })
      .onConflictDoUpdate({
        target: [approvalPolicies.orgId, approvalPolicies.documentType],
        set: { required, updatedAt: new Date() },
      })
      .returning();
    return toDomain(row);
  }
}

function toDomain(row: typeof approvalPolicies.$inferSelect): ApprovalPolicy {
  return {
    id: row.id,
    orgId: row.orgId,
    documentType: row.documentType as ApprovalDocumentType,
    required: row.required,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
