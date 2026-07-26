import type {
  GoodsReceiptPort,
  IdempotencyPort,
  LocationLookupPort,
  LotPort,
  OutboxPort,
  ProductLookupPort,
  PurchaseOrderPort,
  ReservationPort,
  SerialPort,
  StockAdjustmentPort,
  StockCountPort,
  StockIssuePort,
  StockPort,
  StockTransferPort,
} from "./inventory.js";

export interface UowContext {
  po: PurchaseOrderPort;
  gr: GoodsReceiptPort;
  issues?: StockIssuePort;
  transfers?: StockTransferPort;
  adjustments?: StockAdjustmentPort;
  counts?: StockCountPort;
  reservations?: ReservationPort;
  products: ProductLookupPort;
  locations?: LocationLookupPort;
  stock: StockPort;
  lots: LotPort;
  serials: SerialPort;
  outbox: OutboxPort;
  idempotency: IdempotencyPort;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: UowContext) => Promise<T>): Promise<T>;
}
