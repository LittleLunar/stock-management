import type {
  CostingMethod,
  IssueType,
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
  Pick<
    CreatePurchaseOrderInput,
    "supplierId" | "branchId" | "documentNumber" | "expectedDate"
  >
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

export type OutboundLineInput = {
  id?: string;
  productId: string;
  qty: string;
  lotId?: string | null;
  serialNumbers?: string[];
  lineNumber: number;
};

export type CreateStockIssueInput = {
  branchId: string;
  locationId: string;
  documentNumber?: string | null;
  issueType: IssueType;
  reasonNote?: string | null;
  lines: OutboundLineInput[];
};

export type UpdateStockIssueInput = Partial<
  Omit<CreateStockIssueInput, "lines">
> & {
  lines?: OutboundLineInput[];
};

export type CreateStockTransferInput = {
  fromLocationId: string;
  toLocationId: string;
  transitLocationId: string;
  documentNumber?: string | null;
  lines: OutboundLineInput[];
};

export type UpdateStockTransferInput = Partial<
  Omit<CreateStockTransferInput, "lines">
> & {
  lines?: OutboundLineInput[];
};

export type CreateStockAdjustmentInput = {
  branchId: string;
  locationId: string;
  documentNumber?: string | null;
  reasonCode: string;
  reasonNote?: string | null;
  lines: OutboundLineInput[];
};

export type UpdateStockAdjustmentInput = Partial<
  Omit<CreateStockAdjustmentInput, "lines">
> & {
  lines?: OutboundLineInput[];
};

export type StockCountLineInput = {
  id?: string;
  productId: string;
  lotId?: string | null;
  countedQty: string | null;
  lineNumber: number;
};

export type CreateStockCountInput = {
  branchId: string;
  locationId: string;
  documentNumber?: string | null;
  lines: StockCountLineInput[];
};

export type UpdateStockCountInput = Partial<
  Omit<CreateStockCountInput, "lines">
> & {
  lines?: StockCountLineInput[];
};

export type IdempotencyInput = {
  externalSystem: string;
  externalId: string;
};

export type CreateReservationInput = {
  branchId: string;
  productId: string;
  locationId: string;
  qty: string;
  lotId?: string | null;
  expiresAt?: Date | null;
  externalSystem?: string | null;
  externalId?: string | null;
};

export type UpdateReservationInput = {
  status?: "open" | "committed" | "released";
  committedIssueId?: string | null;
};

export type CreateCustomerInput = {
  code: string;
  name: string;
  status?: MasterStatus;
};

export type SupplierReturnLineInput = {
  id?: string;
  productId: string;
  qty: string;
  lotId?: string | null;
  goodsReceiptLineId?: string | null;
  serialNumbers?: string[];
  lineNumber: number;
};

export type CreateSupplierReturnInput = {
  branchId: string;
  locationId: string;
  supplierId: string;
  goodsReceiptId?: string | null;
  documentNumber?: string | null;
  externalSystem?: string | null;
  externalId?: string | null;
  lines: SupplierReturnLineInput[];
};

export type UpdateSupplierReturnInput = Partial<
  Omit<CreateSupplierReturnInput, "lines">
> & {
  lines?: SupplierReturnLineInput[];
};

export type CustomerReturnLineInput = {
  id?: string;
  productId: string;
  qty: string;
  lotId?: string | null;
  serialNumbers?: string[];
  lineNumber: number;
};

export type CreateCustomerReturnInput = {
  branchId: string;
  locationId: string;
  customerId: string;
  documentNumber?: string | null;
  externalSystem?: string | null;
  externalId?: string | null;
  lines: CustomerReturnLineInput[];
};

export type UpdateCustomerReturnInput = Partial<
  Omit<CreateCustomerReturnInput, "lines">
> & {
  lines?: CustomerReturnLineInput[];
};
