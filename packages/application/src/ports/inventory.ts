import type {
  GoodsReceipt,
  GoodsReceiptLine,
  Lot,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  Serial,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import type {
  CreateGoodsReceiptInput,
  CreatePurchaseOrderInput,
  UpdateGoodsReceiptInput,
  UpdatePurchaseOrderInput,
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
  create(orgId: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithLines>;
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
  create(orgId: string, input: CreateGoodsReceiptInput): Promise<GoodsReceiptWithLines>;
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

export interface ProductLookupPort {
  findById(orgId: string, id: string): Promise<Product | null>;
}

export type StockBalanceKey = Pick<
  StockBalance,
  "orgId" | "productId" | "locationId" | "lotId"
>;

export type CreateStockMovementInput = Omit<StockMovement, "id" | "createdAt"> & {
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
