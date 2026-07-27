import { z } from "zod";

export const MasterStatusSchema = z.enum(["active", "inactive"]);
export type MasterStatus = z.infer<typeof MasterStatusSchema>;

export const LocationTypeSchema = z.enum([
  "storage",
  "receiving",
  "transit",
  "quarantine",
]);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const MembershipRoleSchema = z.enum([
  "org_admin",
  "branch_manager",
  "warehouse",
  "purchasing",
  "accountant",
]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const CostingMethodSchema = z.enum(["fifo", "avg"]);
export type CostingMethod = z.infer<typeof CostingMethodSchema>;

export const PoStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "partially_received",
  "received",
  "closed",
  "cancelled",
]);
export type PoStatus = z.infer<typeof PoStatusSchema>;

export const DocumentStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "void",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const ApprovalDocumentTypeSchema = z.enum([
  "purchase_order",
  "stock_adjustment",
]);
export type ApprovalDocumentType = z.infer<typeof ApprovalDocumentTypeSchema>;

export const UpsertApprovalPolicySchema = z.object({
  documentType: ApprovalDocumentTypeSchema,
  required: z.boolean(),
});
export type UpsertApprovalPolicy = z.infer<typeof UpsertApprovalPolicySchema>;

export const TransferPurposeSchema = z.enum(["standard", "replenishment"]);
export type TransferPurpose = z.infer<typeof TransferPurposeSchema>;

export const UuidSchema = z.string().uuid();
