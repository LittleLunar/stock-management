export type MasterStatus = "active" | "inactive";

export type LocationType = "storage" | "receiving" | "transit" | "quarantine";

export type MembershipRole =
  | "org_admin"
  | "branch_manager"
  | "warehouse"
  | "purchasing"
  | "accountant";

export type CostingMethod = "fifo" | "avg";

export type PoStatus =
  | "draft"
  | "submitted"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export type DocumentStatus = "draft" | "posted" | "void";

export type LotStatus = "active" | "depleted" | "quarantine";

export type SerialStatus = "in_stock" | "issued" | "returned";

export type MovementType = "receipt" | "receipt_void";
