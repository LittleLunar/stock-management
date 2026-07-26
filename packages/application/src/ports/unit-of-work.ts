import type { CostingPort } from "./costing.js";
import type {
  CustomerReturnPort,
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
  SupplierReturnPort,
} from "./inventory.js";
import type { LandedCostPort } from "./landed-cost.js";
import type { CostRevaluationPort } from "./revaluation.js";
import type { CustomerRepository } from "./repositories.js";

export interface UowContext {
  po: PurchaseOrderPort;
  gr: GoodsReceiptPort;
  issues?: StockIssuePort;
  transfers?: StockTransferPort;
  adjustments?: StockAdjustmentPort;
  counts?: StockCountPort;
  reservations?: ReservationPort;
  supplierReturns?: SupplierReturnPort;
  customerReturns?: CustomerReturnPort;
  customers?: CustomerRepository;
  products: ProductLookupPort;
  locations?: LocationLookupPort;
  stock: StockPort;
  lots: LotPort;
  serials: SerialPort;
  costing: CostingPort;
  landedCosts?: LandedCostPort;
  revaluations?: CostRevaluationPort;
  outbox: OutboxPort;
  idempotency: IdempotencyPort;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: UowContext) => Promise<T>): Promise<T>;
}
