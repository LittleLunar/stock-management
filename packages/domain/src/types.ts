export type MasterStatus = "active" | "inactive";

export type LocationType = "storage" | "receiving" | "transit" | "quarantine";

export type MembershipRole =
  | "org_admin"
  | "branch_manager"
  | "warehouse"
  | "purchasing"
  | "accountant";

export type CostingMethod = "fifo" | "avg";
