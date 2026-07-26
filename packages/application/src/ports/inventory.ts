import type {
  GoodsReceipt,
  GoodsReceiptLine,
  Location,
  Lot,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  Serial,
  StockAdjustment,
  StockAdjustmentLine,
  StockBalance,
  StockCount,
  StockCountLine,
  StockIssue,
  StockIssueLine,
  StockMovement,
  StockTransfer,
  StockTransferLine,
} from "@stock-management/domain";
import type {
  CreateStockAdjustmentInput,
  CreateStockCountInput,
  CreateGoodsReceiptInput,
  CreatePurchaseOrderInput,
  CreateStockIssueInput,
  CreateStockTransferInput,
  StockCountLineInput,
  UpdateStockAdjustmentInput,
  UpdateStockCountInput,
  UpdateGoodsReceiptInput,
  UpdatePurchaseOrderInput,
  UpdateStockIssueInput,
  UpdateStockTransferInput,
} from "../dto/inputs.js";

export type PurchaseOrderWithLines = PurchaseOrder & {
  lines: PurchaseOrderLine[];
};

export type GoodsReceiptLineDetails = GoodsReceiptLine & {
  lotCode?: string | null;
  expiryDate?: Date | null;
  serialNumbers: string[];
};

export type GoodsReceiptWithLines = GoodsReceipt & {
  lines: GoodsReceiptLineDetails[];
};

export interface PurchaseOrderPort {
  list(orgId: string): Promise<PurchaseOrder[]>;
  findById(orgId: string, id: string): Promise<PurchaseOrderWithLines | null>;
  findLineById(orgId: string, id: string): Promise<PurchaseOrderLine | null>;
  create(
    orgId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines | null>;
  updateLineReceivedQty(
    orgId: string,
    lineId: string,
    receivedQty: string,
  ): Promise<PurchaseOrderLine>;
  updateStatus(
    orgId: string,
    id: string,
    status: PurchaseOrder["status"],
  ): Promise<PurchaseOrder>;
}

export interface GoodsReceiptPort {
  list(orgId: string): Promise<GoodsReceipt[]>;
  findById(orgId: string, id: string): Promise<GoodsReceiptWithLines | null>;
  create(
    orgId: string,
    input: CreateGoodsReceiptInput,
  ): Promise<GoodsReceiptWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdateGoodsReceiptInput,
  ): Promise<GoodsReceiptWithLines | null>;
  updateStatus(
    orgId: string,
    id: string,
    status: GoodsReceipt["status"],
    occurredAt: Date,
  ): Promise<GoodsReceipt>;
  setLineLotId(orgId: string, lineId: string, lotId: string): Promise<void>;
}

export type OutboundLineDetails<T> = T & {
  serialNumbers: string[];
};

export type StockIssueWithLines = StockIssue & {
  lines: OutboundLineDetails<StockIssueLine>[];
};

export interface StockIssuePort {
  list(orgId: string): Promise<StockIssue[]>;
  findById(orgId: string, id: string): Promise<StockIssueWithLines | null>;
  create(
    orgId: string,
    input: CreateStockIssueInput,
  ): Promise<StockIssueWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdateStockIssueInput,
  ): Promise<StockIssueWithLines | null>;
  updateStatus(
    orgId: string,
    id: string,
    status: StockIssue["status"],
    occurredAt: Date,
  ): Promise<StockIssue>;
}

export type StockTransferWithLines = StockTransfer & {
  lines: OutboundLineDetails<StockTransferLine>[];
};

export interface StockTransferPort {
  list(orgId: string): Promise<StockTransfer[]>;
  findById(orgId: string, id: string): Promise<StockTransferWithLines | null>;
  create(
    orgId: string,
    input: CreateStockTransferInput,
  ): Promise<StockTransferWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdateStockTransferInput,
  ): Promise<StockTransferWithLines | null>;
  updateStatus(
    orgId: string,
    id: string,
    status: StockTransfer["status"],
    occurredAt: Date,
  ): Promise<StockTransfer>;
}

export type StockAdjustmentWithLines = StockAdjustment & {
  lines: OutboundLineDetails<StockAdjustmentLine>[];
};

export interface StockAdjustmentPort {
  list(orgId: string): Promise<StockAdjustment[]>;
  findById(orgId: string, id: string): Promise<StockAdjustmentWithLines | null>;
  create(
    orgId: string,
    input: CreateStockAdjustmentInput,
  ): Promise<StockAdjustmentWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdateStockAdjustmentInput,
  ): Promise<StockAdjustmentWithLines | null>;
  updateStatus(
    orgId: string,
    id: string,
    status: StockAdjustment["status"],
    occurredAt: Date,
  ): Promise<StockAdjustment>;
}

export type StockCountWithLines = StockCount & {
  lines: StockCountLine[];
};

export type StockCountLineSnapshotInput = StockCountLineInput & {
  expectedQty: string;
};

export type CreateStockCountSnapshotInput = Omit<
  CreateStockCountInput,
  "lines"
> & {
  lines: StockCountLineSnapshotInput[];
};

export type UpdateStockCountSnapshotInput = Omit<
  UpdateStockCountInput,
  "lines"
> & {
  lines?: StockCountLineSnapshotInput[];
};

export interface StockCountPort {
  list(orgId: string): Promise<StockCount[]>;
  findById(orgId: string, id: string): Promise<StockCountWithLines | null>;
  create(
    orgId: string,
    input: CreateStockCountSnapshotInput,
  ): Promise<StockCountWithLines>;
  update(
    orgId: string,
    id: string,
    input: UpdateStockCountSnapshotInput,
  ): Promise<StockCountWithLines | null>;
  updateStatus(
    orgId: string,
    id: string,
    status: StockCount["status"],
    occurredAt: Date,
  ): Promise<StockCount>;
}

export interface ProductLookupPort {
  findById(orgId: string, id: string): Promise<Product | null>;
}

export interface LocationLookupPort {
  findById(orgId: string, id: string): Promise<Location | null>;
}

export type StockBalanceKey = Pick<
  StockBalance,
  "orgId" | "productId" | "locationId" | "lotId"
>;

export type CreateStockMovementInput = Omit<
  StockMovement,
  "id" | "createdAt"
> & {
  createdAt?: Date;
};

export interface StockPort {
  findBalance(key: StockBalanceKey): Promise<StockBalance | null>;
  setBalance(key: StockBalanceKey, qtyOnHand: string): Promise<StockBalance>;
  insertMovement(input: CreateStockMovementInput): Promise<StockMovement>;
  listBalances(
    orgId: string,
    filters?: { productId?: string; locationId?: string; lowStock?: boolean },
  ): Promise<StockBalance[]>;
  listMovements(
    orgId: string,
    filters?: {
      productId?: string;
      locationId?: string;
      documentType?: string;
      documentId?: string;
    },
  ): Promise<StockMovement[]>;
}

export type UpsertLotInput = {
  orgId: string;
  productId: string;
  lotId?: string | null;
  lotCode?: string | null;
  expiryDate?: Date | null;
};

export interface LotPort {
  upsert(input: UpsertLotInput): Promise<Lot>;
  list(orgId: string, filters?: { productId?: string }): Promise<Lot[]>;
}

export type UpsertSerialInput = {
  orgId: string;
  productId: string;
  lotId: string | null;
  serialNumber: string;
};

export interface SerialPort {
  upsert(input: UpsertSerialInput): Promise<Serial>;
  findByNumber?(
    orgId: string,
    productId: string,
    serialNumber: string,
  ): Promise<Serial | null>;
  updateStatus?(
    orgId: string,
    id: string,
    status: Serial["status"],
  ): Promise<Serial>;
  list(orgId: string, filters?: { productId?: string }): Promise<Serial[]>;
}

export type OutboxEventInput = {
  orgId: string;
  eventType: "document.posted" | "document.voided" | "stock.changed";
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export interface OutboxPort {
  enqueue(event: OutboxEventInput): Promise<void>;
}

export type IdempotencyRecord = {
  orgId: string;
  operation: string;
  externalSystem: string;
  externalId: string;
  result: unknown;
};

export interface IdempotencyPort {
  find(
    orgId: string,
    operation: string,
    externalSystem: string,
    externalId: string,
  ): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
