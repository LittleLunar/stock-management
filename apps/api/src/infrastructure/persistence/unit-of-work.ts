import type { UnitOfWork, UowContext } from "@stock-management/application";
import type { Db } from "../db/client.js";
import { DrizzleCustomerRepository } from "./customer.repository.js";
import { DrizzleCustomerReturnRepository } from "./customer-return.repository.js";
import { DrizzleGoodsReceiptRepository } from "./goods-receipt.repository.js";
import { DrizzleIdempotencyRepository } from "./idempotency.repository.js";
import { DrizzleLocationRepository } from "./location.repository.js";
import { DrizzleLotRepository } from "./lot.repository.js";
import { DrizzleOutboxRepository } from "./outbox.repository.js";
import { DrizzleProductRepository } from "./product.repository.js";
import { DrizzlePurchaseOrderRepository } from "./purchase-order.repository.js";
import { DrizzleReservationRepository } from "./reservation.repository.js";
import { DrizzleSerialRepository } from "./serial.repository.js";
import { DrizzleStockAdjustmentRepository } from "./stock-adjustment.repository.js";
import { DrizzleStockCountRepository } from "./stock-count.repository.js";
import { DrizzleStockIssueRepository } from "./stock-issue.repository.js";
import { DrizzleStockRepository } from "./stock.repository.js";
import { DrizzleStockTransferRepository } from "./stock-transfer.repository.js";
import { DrizzleSupplierReturnRepository } from "./supplier-return.repository.js";

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(fn: (context: UowContext) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      fn({
        po: new DrizzlePurchaseOrderRepository(tx, true),
        gr: new DrizzleGoodsReceiptRepository(tx, true),
        issues: new DrizzleStockIssueRepository(tx, true),
        transfers: new DrizzleStockTransferRepository(tx, true),
        adjustments: new DrizzleStockAdjustmentRepository(tx, true),
        counts: new DrizzleStockCountRepository(tx, true),
        reservations: new DrizzleReservationRepository(tx, true),
        supplierReturns: new DrizzleSupplierReturnRepository(tx, true),
        customerReturns: new DrizzleCustomerReturnRepository(tx, true),
        customers: new DrizzleCustomerRepository(tx as unknown as Db),
        products: new DrizzleProductRepository(tx as unknown as Db),
        locations: new DrizzleLocationRepository(tx),
        stock: new DrizzleStockRepository(tx, true),
        lots: new DrizzleLotRepository(tx),
        serials: new DrizzleSerialRepository(tx),
        outbox: new DrizzleOutboxRepository(tx),
        idempotency: new DrizzleIdempotencyRepository(tx, true),
      }),
    );
  }
}
