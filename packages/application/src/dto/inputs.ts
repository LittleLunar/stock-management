import type {
  CostingMethod,
  LocationType,
  MasterStatus,
  MembershipRole,
} from "@stock-management/domain";

export type CreateOrganizationInput = {
  name: string;
  currency?: string;
  timezone?: string;
  fiscalYearStartMonth?: number;
};

export type UpdateOrganizationInput = {
  name?: string;
  currency?: string;
  timezone?: string;
  fiscalYearStartMonth?: number;
  status?: MasterStatus;
};

export type CreateBranchInput = {
  code: string;
  name: string;
  status?: MasterStatus;
};

export type UpdateBranchInput = {
  code?: string;
  name?: string;
  status?: MasterStatus;
};

export type CreateLocationInput = {
  branchId: string;
  code: string;
  name: string;
  type?: LocationType;
  status?: MasterStatus;
};

export type UpdateLocationInput = {
  code?: string;
  name?: string;
  type?: LocationType;
  status?: MasterStatus;
};

export type CreateCategoryInput = {
  code: string;
  name: string;
  status?: MasterStatus;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export type CreateProductInput = {
  sku: string;
  name: string;
  uom?: string;
  categoryId?: string | null;
  trackLot?: boolean;
  trackSerial?: boolean;
  trackExpiry?: boolean;
  costingMethod?: CostingMethod;
  reorderMin?: string | null;
  reorderMax?: string | null;
  status?: MasterStatus;
  barcodes?: string[];
};

export type UpdateProductInput = Partial<Omit<CreateProductInput, "barcodes">>;

export type CreateSupplierInput = {
  code: string;
  name: string;
  status?: MasterStatus;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export type CreateUserInput = {
  email: string;
  name: string;
  status?: MasterStatus;
};

export type CreateMembershipInput = {
  userId: string;
  role: MembershipRole;
  branchIds?: string[];
  status?: MasterStatus;
};
