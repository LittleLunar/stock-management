import type { UnitOfWork, UowContext } from "@stock-management/application";
import type { Db } from "../db/client.js";
import { DrizzleGoodsReceiptRepository } from "./goods-receipt.repository.js";
import { DrizzleIdempotencyRepository } from "./idempotency.repository.js";
import { DrizzleLotRepository } from "./lot.repository.js";
import { DrizzleOutboxRepository } from "./outbox.repository.js";
import { DrizzleProductRepository } from "./product.repository.js";
import { DrizzlePurchaseOrderRepository } from "./purchase-order.repository.js";
import { DrizzleSerialRepository } from "./serial.repository.js";
import { DrizzleStockRepository } from "./stock.repository.js";

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(fn: (context: UowContext) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      fn({
        po: new DrizzlePurchaseOrderRepository(tx, true),
        gr: new DrizzleGoodsReceiptRepository(tx, true),
        products: new DrizzleProductRepository(tx as unknown as Db),
        stock: new DrizzleStockRepository(tx, true),
        lots: new DrizzleLotRepository(tx),
        serials: new DrizzleSerialRepository(tx),
        outbox: new DrizzleOutboxRepository(tx),
        idempotency: new DrizzleIdempotencyRepository(tx, true),
      }),
    );
  }
}
