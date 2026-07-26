import type {
  AccountType,
  CostingMethod,
  DocumentStatus,
  IssueType,
  JournalEventType,
  LocationType,
  LotStatus,
  MasterStatus,
  MembershipRole,
  MovementType,
  PeriodStatus,
  PoStatus,
  ReservationStatus,
  SerialStatus,
  SupplierInvoiceStatus,
  TransferStatus,
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

export type Customer = {
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
  branchIds: string[]; // empty = HQ / all branches
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
  locationId: string | null;
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
  unitCost: string | null;
  totalCost: string | null;
  createdAt: Date;
};

export type CostLayer = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentLineId: string | null;
  sourceMovementId: string;
  receivedAt: Date;
  unitCost: string;
  originalUnitCost: string;
  qtyOriginal: string;
  qtyRemaining: string;
};

export type CostConsumption = {
  id: string;
  orgId: string;
  costLayerId: string;
  movementId: string;
  qty: string;
  unitCost: string;
  totalCost: string;
  isReversal: boolean;
  createdAt: Date;
};

export type CostLayerValueAdjustment = {
  id: string;
  orgId: string;
  costLayerId: string;
  effectiveAt: Date;
  oldUnitCost: string;
  newUnitCost: string;
  amount: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentLineId: string | null;
  createdAt: Date;
};

export type ProductCostSummary = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  qtyRemainingSum: string;
  onHandValue: string;
  updatedAt: Date;
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

export type StockIssue = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  issueType: IssueType;
  reasonNote: string | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type StockIssueLine = {
  id: string;
  orgId: string;
  stockIssueId: string;
  productId: string;
  qty: string;
  lotId: string | null;
  lineNumber: number;
};

export type StockTransfer = {
  id: string;
  orgId: string;
  fromLocationId: string;
  toLocationId: string;
  transitLocationId: string;
  fromBranchId: string;
  toBranchId: string;
  documentNumber: string | null;
  status: TransferStatus;
  createdAt: Date;
  updatedAt: Date;
  shippedAt: Date | null;
  receivedAt: Date | null;
  voidedAt: Date | null;
};

export type StockTransferLine = {
  id: string;
  orgId: string;
  stockTransferId: string;
  productId: string;
  qty: string;
  lotId: string | null;
  lineNumber: number;
};

export type StockAdjustment = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  reasonCode: string;
  reasonNote: string | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type StockAdjustmentLine = {
  id: string;
  orgId: string;
  stockAdjustmentId: string;
  productId: string;
  qty: string;
  lotId: string | null;
  unitCost: string | null;
  lineNumber: number;
};

export type StockCount = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type StockCountLine = {
  id: string;
  orgId: string;
  stockCountId: string;
  productId: string;
  lotId: string | null;
  expectedQty: string;
  countedQty: string | null;
  unitCost: string | null;
  lineNumber: number;
};

export type StockReservation = {
  id: string;
  orgId: string;
  branchId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  qty: string;
  status: ReservationStatus;
  expiresAt: Date | null;
  externalSystem: string | null;
  externalId: string | null;
  committedIssueId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SupplierReturn = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  supplierId: string;
  goodsReceiptId: string | null;
  documentNumber: string | null;
  status: DocumentStatus;
  externalSystem: string | null;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type SupplierReturnLine = {
  id: string;
  orgId: string;
  supplierReturnId: string;
  productId: string;
  qty: string;
  lotId: string | null;
  goodsReceiptLineId: string | null;
  lineNumber: number;
};

export type SupplierReturnSerial = {
  id: string;
  orgId: string;
  supplierReturnLineId: string;
  serialNumber: string;
};

export type CustomerReturn = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  customerId: string;
  documentNumber: string | null;
  status: DocumentStatus;
  externalSystem: string | null;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
};

export type CustomerReturnLine = {
  id: string;
  orgId: string;
  customerReturnId: string;
  productId: string;
  qty: string;
  lotId: string | null;
  unitCost: string | null;
  lineNumber: number;
};

export type CustomerReturnSerial = {
  id: string;
  orgId: string;
  customerReturnLineId: string;
  serialNumber: string;
};

export type Account = {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
  active: boolean;
  createdAt: Date;
};

export type AccountMapping = {
  id: string;
  orgId: string;
  journalEventType: JournalEventType;
  debitAccountId: string;
  creditAccountId: string;
};

export type AccountingPeriod = {
  id: string;
  orgId: string;
  year: number;
  month: number;
  startsOn: string;
  endsOn: string;
  status: PeriodStatus;
};

export type JournalEntry = {
  id: string;
  orgId: string;
  periodId: string;
  branchId: string | null;
  sourceDocumentType: string;
  sourceDocumentId: string;
  outboxEventId: string | null;
  reversesJournalId: string | null;
  postedAt: Date;
  createdAt: Date;
};

export type JournalLine = {
  id: string;
  orgId: string;
  journalEntryId: string;
  accountId: string;
  debit: string;
  credit: string;
  lineNo: number;
};

export type JournalLineDraft = {
  accountId: string;
  debit: string;
  credit: string;
  lineNo: number;
};

export type SupplierInvoice = {
  id: string;
  orgId: string;
  supplierId: string;
  branchId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: SupplierInvoiceStatus;
  externalSystem: string | null;
  externalId: string | null;
  postedAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SupplierInvoiceLine = {
  id: string;
  orgId: string;
  supplierInvoiceId: string;
  productId: string | null;
  lineNumber: number;
  qty: string;
  unitCost: string;
  amount: string;
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
};

export type InvoiceMatch = {
  id: string;
  orgId: string;
  supplierInvoiceLineId: string;
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
  matchedQty: string;
  matchedAmount: string;
};
