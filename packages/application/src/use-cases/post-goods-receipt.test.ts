import type {
  GoodsReceipt,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { OverReceiveError } from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  GoodsReceiptWithLines,
  IdempotencyRecord,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { PostGoodsReceipt } from "./post-goods-receipt.js";
import { VoidGoodsReceipt } from "./void-goods-receipt.js";

const now = new Date("2026-07-26T00:00:00.000Z");

function makeFake(receivingQty = "3") {
  const po: PurchaseOrder = {
    id: "po-1",
    orgId: "org-1",
    supplierId: "supplier-1",
    branchId: "branch-1",
    status: "submitted",
    documentNumber: "PO-1",
    expectedDate: null,
    createdAt: now,
    updatedAt: now,
  };
  const poLine: PurchaseOrderLine = {
    id: "po-line-1",
    orgId: "org-1",
    purchaseOrderId: po.id,
    productId: "product-1",
    orderedQty: "5",
    receivedQty: "0",
    unitCost: "10",
    lineNumber: 1,
  };
  const receipt: GoodsReceipt = {
    id: "gr-1",
    orgId: "org-1",
    purchaseOrderId: po.id,
    supplierId: po.supplierId,
    branchId: po.branchId,
    locationId: "location-1",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    postedAt: null,
    voidedAt: null,
  };
  const receiptWithLines: GoodsReceiptWithLines = {
    ...receipt,
    lines: [
      {
        id: "gr-line-1",
        orgId: "org-1",
        goodsReceiptId: receipt.id,
        productId: poLine.productId,
        purchaseOrderLineId: poLine.id,
        qty: receivingQty,
        unitCost: "10",
        lotId: null,
        lineNumber: 1,
        serialNumbers: [],
      },
    ],
  };
  const product: Product = {
    id: "product-1",
    orgId: "org-1",
    sku: "SKU-1",
    name: "Widget",
    uom: "each",
    categoryId: null,
    trackLot: false,
    trackSerial: false,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  let currentReceipt = receiptWithLines;
  let currentPo = { ...po, lines: [poLine] };
  const balances = new Map<string, StockBalance>();
  const movements: StockMovement[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();
  let sequence = 0;

  const balanceKey = (productId: string, locationId: string, lotId: string | null) =>
    `${productId}:${locationId}:${lotId ?? ""}`;

  const ctx: UowContext = {
    po: {
      async list() {
        return [currentPo];
      },
      async findById(_orgId, id) {
        return id === currentPo.id ? currentPo : null;
      },
      async findLineById(_orgId, id) {
        return currentPo.lines.find((line) => line.id === id) ?? null;
      },
      async create() {
        return currentPo;
      },
      async update() {
        return currentPo;
      },
      async updateLineReceivedQty(_orgId, lineId, receivedQty) {
        const line = currentPo.lines.find((candidate) => candidate.id === lineId)!;
        const updated = { ...line, receivedQty };
        currentPo = {
          ...currentPo,
          lines: currentPo.lines.map((candidate) =>
            candidate.id === lineId ? updated : candidate,
          ),
        };
        return updated;
      },
      async updateStatus(_orgId, _id, status) {
        currentPo = { ...currentPo, status };
        return currentPo;
      },
    },
    gr: {
      async list() {
        return [currentReceipt];
      },
      async findById(_orgId, id) {
        return id === currentReceipt.id ? currentReceipt : null;
      },
      async create() {
        return currentReceipt;
      },
      async update() {
        return currentReceipt;
      },
      async updateStatus(_orgId, _id, status, occurredAt) {
        currentReceipt = {
          ...currentReceipt,
          status,
          postedAt: status === "posted" ? occurredAt : currentReceipt.postedAt,
          voidedAt: status === "void" ? occurredAt : currentReceipt.voidedAt,
        };
        return currentReceipt;
      },
      async setLineLotId() {},
    },
    products: {
      async findById(_orgId, id) {
        return id === product.id ? product : null;
      },
    },
    stock: {
      async findBalance(key) {
        return (
          balances.get(balanceKey(key.productId, key.locationId, key.lotId)) ?? null
        );
      },
      async setBalance(key, qtyOnHand) {
        const balance: StockBalance = {
          id: "balance-1",
          ...key,
          qtyOnHand,
          qtyReserved: "0",
          updatedAt: now,
        };
        balances.set(balanceKey(key.productId, key.locationId, key.lotId), balance);
        return balance;
      },
      async insertMovement(input) {
        const movement: StockMovement = {
          ...input,
          id: `movement-${++sequence}`,
          createdAt: input.createdAt ?? now,
        };
        movements.push(movement);
        return movement;
      },
      async listBalances() {
        return [...balances.values()];
      },
      async listMovements() {
        return movements;
      },
    },
    lots: {
      async upsert() {
        throw new Error("lot upsert should not be called for untracked product");
      },
      async list() {
        return [];
      },
    },
    serials: {
      async upsert() {
        throw new Error("serial upsert should not be called for untracked product");
      },
      async list() {
        return [];
      },
    },
    outbox: {
      async enqueue() {},
    },
    idempotency: {
      async find(orgId, operation, externalSystem, externalId) {
        return idempotency.get(`${orgId}:${operation}:${externalSystem}:${externalId}`) ?? null;
      },
      async save(record) {
        idempotency.set(
          `${record.orgId}:${record.operation}:${record.externalSystem}:${record.externalId}`,
          record,
        );
      },
    },
  };

  const uow: UnitOfWork = {
    run(fn) {
      return fn(ctx);
    },
  };

  return {
    uow,
    getBalance: () =>
      balances.get(balanceKey(product.id, receipt.locationId, null)) ?? null,
    getReceipt: () => currentReceipt,
    getMovements: () => movements,
  };
}

describe("PostGoodsReceipt", () => {
  it("increases stock balance when a draft receipt is posted", async () => {
    const fake = makeFake();
    const useCase = new PostGoodsReceipt(fake.uow);

    const result = await useCase.execute("org-1", "user-1", "gr-1");

    expect(fake.getBalance()?.qtyOnHand).toBe("3");
    expect(fake.getReceipt().status).toBe("posted");
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.qty).toBe("3");
  });

  it("returns the prior result for the same external idempotency key", async () => {
    const fake = makeFake();
    const useCase = new PostGoodsReceipt(fake.uow);
    const key = { externalSystem: "wms", externalId: "receipt-42" };

    const first = await useCase.execute("org-1", "user-1", "gr-1", key);
    const second = await useCase.execute("org-1", "user-1", "gr-1", key);

    expect(second).toEqual(first);
    expect(fake.getMovements()).toHaveLength(1);
    expect(fake.getBalance()?.qtyOnHand).toBe("3");
  });

  it("rejects receiving more than the purchase order quantity", async () => {
    const fake = makeFake("6");
    const useCase = new PostGoodsReceipt(fake.uow);

    await expect(
      useCase.execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(OverReceiveError);
    expect(fake.getBalance()).toBeNull();
    expect(fake.getMovements()).toHaveLength(0);
  });
});

describe("VoidGoodsReceipt", () => {
  it("reverses receipt movements and restores the stock balance", async () => {
    const fake = makeFake();
    await new PostGoodsReceipt(fake.uow).execute("org-1", "user-1", "gr-1");

    const result = await new VoidGoodsReceipt(fake.uow).execute(
      "org-1",
      "user-1",
      "gr-1",
    );

    expect(fake.getBalance()?.qtyOnHand).toBe("0");
    expect(fake.getReceipt().status).toBe("void");
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.movementType).toBe("receipt_void");
    expect(result.movements[0]?.qty).toBe("-3");
  });
});
