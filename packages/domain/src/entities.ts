import type {
  CostingMethod,
  LocationType,
  MasterStatus,
  MembershipRole,
} from "./types.js";

export type Organization = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Branch = {
  id: string;
  orgId: string;
  code: string;
  name: string;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Location = {
  id: string;
  orgId: string;
  branchId: string;
  code: string;
  name: string;
  type: LocationType;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Category = {
  id: string;
  orgId: string;
  code: string;
  name: string;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Product = {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  uom: string;
  categoryId: string | null;
  trackLot: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  costingMethod: CostingMethod;
  reorderMin: string | null;
  reorderMax: string | null;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductBarcode = {
  id: string;
  orgId: string;
  productId: string;
  barcode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Supplier = {
  id: string;
  orgId: string;
  code: string;
  name: string;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Membership = {
  id: string;
  orgId: string;
  userId: string;
  role: MembershipRole;
  status: MasterStatus;
  createdAt: Date;
  updatedAt: Date;
};
