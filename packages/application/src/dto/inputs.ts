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

export type PurchaseOrderLineInput = {
  id?: string;
  productId: string;
  orderedQty: string;
  unitCost?: string | null;
  lineNumber: number;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  branchId: string;
  documentNumber?: string | null;
  expectedDate?: Date | null;
  lines: PurchaseOrderLineInput[];
};

export type UpdatePurchaseOrderInput = Partial<
  Pick<CreatePurchaseOrderInput, "supplierId" | "branchId" | "documentNumber" | "expectedDate">
> & {
  lines?: PurchaseOrderLineInput[];
};

export type GoodsReceiptLineInput = {
  id?: string;
  productId: string;
  purchaseOrderLineId?: string | null;
  qty: string;
  unitCost?: string | null;
  lotId?: string | null;
  lotCode?: string | null;
  expiryDate?: Date | null;
  serialNumbers?: string[];
  lineNumber: number;
};

export type CreateGoodsReceiptInput = {
  purchaseOrderId?: string | null;
  supplierId?: string | null;
  branchId: string;
  locationId: string;
  lines: GoodsReceiptLineInput[];
};

export type UpdateGoodsReceiptInput = Partial<
  Pick<
    CreateGoodsReceiptInput,
    "purchaseOrderId" | "supplierId" | "branchId" | "locationId"
  >
> & {
  lines?: GoodsReceiptLineInput[];
};

export type IdempotencyInput = {
  externalSystem: string;
  externalId: string;
};
