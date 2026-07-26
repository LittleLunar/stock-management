import type {
  GoodsReceiptPort,
  IdempotencyPort,
  LotPort,
  OutboxPort,
  ProductLookupPort,
  PurchaseOrderPort,
  SerialPort,
  StockPort,
} from "./inventory.js";

export interface UowContext {
  po: PurchaseOrderPort;
  gr: GoodsReceiptPort;
  products: ProductLookupPort;
  stock: StockPort;
  lots: LotPort;
  serials: SerialPort;
  outbox: OutboxPort;
  idempotency: IdempotencyPort;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: UowContext) => Promise<T>): Promise<T>;
}
