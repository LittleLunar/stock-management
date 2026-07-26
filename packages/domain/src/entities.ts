import type {
  CostingMethod,
  DocumentStatus,
  LocationType,
  LotStatus,
  MasterStatus,
  MembershipRole,
  MovementType,
  PoStatus,
  SerialStatus,
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

export type Lot = {
  id: string;
  orgId: string;
  productId: string;
  lotCode: string;
  expiryDate: Date | null;
  status: LotStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Serial = {
  id: string;
  orgId: string;
  productId: string;
  lotId: string | null;
  serialNumber: string;
  status: SerialStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type StockBalance = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  qtyOnHand: string;
  qtyReserved: string;
  updatedAt: Date;
};

export type StockMovement = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  documentType: string;
  documentId: string;
  documentLineId: string | null;
  movementType: MovementType;
  qty: string;
  createdAt: Date;
};

export type PurchaseOrder = {
  id: string;
  orgId: string;
  supplierId: string;
  branchId: string;
  status: PoStatus;
  documentNumber: string | null;
  expectedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseOrderLine = {
  id: string;
  orgId: string;
  purchaseOrderId: string;
  productId: string;
  orderedQty: string;
  receivedQty: string;
  unitCost: string | null;
  lineNumber: number;
};

export type GoodsReceipt = {
  id: string;
  orgId: string;
  purchaseOrderId: string | null;
  supplierId: string | null;
  branchId: string;
  locationId: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type GoodsReceiptLine = {
  id: string;
  orgId: string;
  goodsReceiptId: string;
  productId: string;
  purchaseOrderLineId: string | null;
  qty: string;
  unitCost: string | null;
  lotId: string | null;
  lineNumber: number;
};

export type GoodsReceiptSerial = {
  id: string;
  orgId: string;
  goodsReceiptLineId: string;
  serialNumber: string;
};
