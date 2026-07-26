export type MasterStatus = "active" | "inactive";

export type LocationType = "storage" | "receiving" | "transit" | "quarantine";

export type MembershipRole =
  "org_admin" | "branch_manager" | "warehouse" | "purchasing" | "accountant";

export type CostingMethod = "fifo" | "avg";

export type PoStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export type DocumentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "void";

export type ApprovalDocumentType = "purchase_order" | "stock_adjustment";

export const ISSUE_TYPES = ["consume", "sample", "write_off", "other"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export type TransferStatus = "draft" | "in_transit" | "received" | "void";

export type TransferPurpose = "standard" | "replenishment";

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

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type PeriodStatus = "open" | "closed";

export const JOURNAL_EVENT_TYPES = [
  "goods_receipt.posted",
  "goods_receipt.voided",
  "stock_issue.posted",
  "stock_issue.voided",
  "supplier_return.posted",
  "supplier_return.voided",
  "inventory_decrease.posted",
  "inventory_decrease.voided",
  "inventory_increase.posted",
  "inventory_increase.voided",
  "landed_cost.posted",
  "landed_cost.voided",
  "cost_revaluation.increase",
  "cost_revaluation.increase.voided",
  "cost_revaluation.decrease",
  "cost_revaluation.decrease.voided",
  "supplier_invoice.posted",
  "supplier_invoice.voided",
] as const;

export type JournalEventType = (typeof JOURNAL_EVENT_TYPES)[number];

export type SupplierInvoiceStatus = "draft" | "posted" | "voided";
