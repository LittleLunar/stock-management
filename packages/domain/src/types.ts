export type MasterStatus = "active" | "inactive";

export type LocationType = "storage" | "receiving" | "transit" | "quarantine";

export type MembershipRole =
  "org_admin" | "branch_manager" | "warehouse" | "purchasing" | "accountant";

export type CostingMethod = "fifo" | "avg";

export type PoStatus =
  | "draft"
  | "submitted"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export type DocumentStatus = "draft" | "posted" | "void";

export const ISSUE_TYPES = ["consume", "sample", "write_off", "other"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export type TransferStatus = "draft" | "in_transit" | "received" | "void";

export type LotStatus = "active" | "depleted" | "quarantine";

export type SerialStatus = "in_stock" | "issued" | "returned";

export type ReservationStatus = "open" | "committed" | "released";

export type MovementType =
  | "receipt"
  | "receipt_void"
  | "issue"
  | "issue_void"
  | "transfer_out"
  | "transfer_out_void"
  | "transfer_in"
  | "transfer_in_void"
  | "adjustment"
  | "adjustment_void"
  | "count_variance"
  | "count_variance_void"
  | "supplier_return"
  | "supplier_return_void"
  | "customer_return"
  | "customer_return_void";
