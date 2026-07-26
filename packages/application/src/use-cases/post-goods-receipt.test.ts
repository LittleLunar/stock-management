import type {
  CostLayer,
  GoodsReceipt,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import {
  LayerInUseError,
  MissingUnitCostError,
  OverReceiveError,
  UnsupportedCostingMethodError,
} from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  GoodsReceiptWithLines,
  IdempotencyRecord,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { PostGoodsReceipt } from "./post-goods-receipt.js";
import { VoidGoodsReceipt } from "./void-goods-receipt.js";

const now = new Date("2026-07-26T00:00:00.000Z");

type FakeOptions = {
  receivingQty?: string;
  lineUnitCost?: string | null;
  poUnitCost?: string | null;
  costingMethod?: "fifo" | "avg";
  withPo?: boolean;
};

function makeFake(options: FakeOptions | string = {}) {
  const opts: FakeOptions =
    typeof options === "string" ? { receivingQty: options } : options;
  const receivingQty = opts.receivingQty ?? "3";
  const withPo = opts.withPo ?? true;
  const outboxEvents: Array<{
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }> = [];

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
    unitCost: opts.poUnitCost === undefined ? "10" : opts.poUnitCost,
    lineNumber: 1,
  };
  const receipt: GoodsReceipt = {
    id: "gr-1",
    orgId: "org-1",
    purchaseOrderId: withPo ? po.id : null,
    supplierId: withPo ? po.supplierId : null,
    branchId: "branch-1",
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
        productId: "product-1",
        purchaseOrderLineId: withPo ? poLine.id : null,
        qty: receivingQty,
        unitCost: opts.lineUnitCost === undefined ? "10" : opts.lineUnitCost,
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
    costingMethod: opts.costingMethod ?? "fifo",
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
  const layers = new Map<string, CostLayer>();
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
        const existing = balances.get(
          balanceKey(key.productId, key.locationId, key.lotId),
        );
        const balance: StockBalance = {
          id: existing?.id ?? "balance-1",
          ...key,
          qtyOnHand,
          qtyReserved: existing?.qtyReserved ?? "0",
          updatedAt: now,
        };
        balances.set(balanceKey(key.productId, key.locationId, key.lotId), balance);
        return balance;
      },
      async setQtyReserved(key, qtyReserved) {
        const existing = balances.get(
          balanceKey(key.productId, key.locationId, key.lotId),
        );
        const balance: StockBalance = {
          id: existing?.id ?? "balance-1",
          ...key,
          qtyOnHand: existing?.qtyOnHand ?? "0",
          qtyReserved,
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
          unitCost: input.unitCost ?? null,
          totalCost: input.totalCost ?? null,
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
    costing: {
      async insertLayer(layer) {
        const created: CostLayer = {
          ...layer,
          originalUnitCost: layer.originalUnitCost ?? layer.unitCost,
          id: layer.id ?? `layer-${++sequence}`,
        };
        layers.set(created.id, created);
        return created;
      },
      async getLayer(orgId, layerId) {
        const layer = layers.get(layerId);
        return layer && layer.orgId === orgId ? layer : null;
      },
      async listOpenLayers(orgId, filter) {
        return [...layers.values()].filter((layer) => {
          if (layer.orgId !== orgId) return false;
          if (Number(layer.qtyRemaining) <= 0) return false;
          if (filter.productId && layer.productId !== filter.productId) return false;
          if (filter.locationId && layer.locationId !== filter.locationId) return false;
          return true;
        });
      },
      async listLayersBySourceDocument(orgId, documentType, documentId) {
        return [...layers.values()].filter(
          (layer) =>
            layer.orgId === orgId &&
            layer.sourceDocumentType === documentType &&
            layer.sourceDocumentId === documentId,
        );
      },
      async setQtyRemaining(orgId, layerId, qtyRemaining) {
        const layer = layers.get(layerId);
        if (!layer || layer.orgId !== orgId) return;
        layers.set(layerId, { ...layer, qtyRemaining });
      },
      async lockOpenLayersFifo(key) {
        return [...layers.values()]
          .filter(
            (layer) =>
              layer.orgId === key.orgId &&
              layer.productId === key.productId &&
              layer.locationId === key.locationId &&
              (layer.lotId ?? null) === (key.lotId ?? null) &&
              Number(layer.qtyRemaining) > 0,
          )
          .sort(
            (a, b) =>
              a.receivedAt.getTime() - b.receivedAt.getTime() ||
              a.id.localeCompare(b.id),
          );
      },
      async listOpenLayersBySourceLine(orgId, sourceDocumentLineId) {
        return [...layers.values()].filter(
          (layer) =>
            layer.orgId === orgId &&
            layer.sourceDocumentLineId === sourceDocumentLineId &&
            Number(layer.qtyRemaining) > 0,
        );
      },
      async insertConsumption() {
        throw new Error("consumption not used in GR tests");
      },
      async listConsumptionsByMovementIds() {
        return [];
      },
      async listLayersForValuation(orgId, filter) {
        return [...layers.values()].filter((layer) => {
          if (layer.orgId !== orgId) return false;
          if (filter.productId && layer.productId !== filter.productId) return false;
          if (filter.locationId && layer.locationId !== filter.locationId) return false;
          if (
            filter.locationIds &&
            filter.locationIds.length > 0 &&
            !filter.locationIds.includes(layer.locationId)
          ) {
            return false;
          }
          return true;
        });
      },
      async updateLayerUnitCost(orgId, layerId, unitCost) {
        const layer = layers.get(layerId);
        if (!layer || layer.orgId !== orgId) return;
        layers.set(layerId, { ...layer, unitCost });
      },
      async listConsumptionsForLayers() {
        return [];
      },
      async insertValueAdjustment() {
        throw new Error("value adjustments not used in GR tests");
      },
      async listAdjustmentsForLayers() {
        return [];
      },
      async listAdjustmentsBySourceDocument() {
        return [];
      },
      async upsertProductCostSummary(row) {
        return {
          id: row.id ?? `summary-${++sequence}`,
          orgId: row.orgId,
          productId: row.productId,
          locationId: row.locationId,
          lotId: row.lotId,
          qtyRemainingSum: row.qtyRemainingSum,
          onHandValue: row.onHandValue,
          updatedAt: row.updatedAt ?? new Date(),
        };
      },
      async recomputeProductCostSummary(key) {
        const open = [...layers.values()].filter(
          (layer) =>
            layer.orgId === key.orgId &&
            layer.productId === key.productId &&
            layer.locationId === key.locationId &&
            (layer.lotId ?? null) === (key.lotId ?? null) &&
            Number(layer.qtyRemaining) > 0,
        );
        let qty = 0;
        let value = 0;
        for (const layer of open) {
          qty += Number(layer.qtyRemaining);
          value += Number(layer.qtyRemaining) * Number(layer.unitCost);
        }
        return {
          id: `summary-${++sequence}`,
          orgId: key.orgId,
          productId: key.productId,
          locationId: key.locationId,
          lotId: key.lotId,
          qtyRemainingSum: String(qty),
          onHandValue: String(value),
          updatedAt: new Date(),
        };
      },
      async listProductCostSummaries() {
        return [];
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
      async enqueue(event) {
        outboxEvents.push({
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
        });
      },
    },
    idempotency: {
      async find(orgId, operation, externalSystem, externalId) {
        return (
          idempotency.get(`${orgId}:${operation}:${externalSystem}:${externalId}`) ??
          null
        );
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
    outbox: outboxEvents,
    getBalance: () =>
      balances.get(balanceKey(product.id, receipt.locationId, null)) ?? null,
    getReceipt: () => currentReceipt,
    getMovements: () => movements,
    partiallyConsumeLayer: (sourceDocumentLineId: string, consumeQty: string) => {
      for (const [id, layer] of layers) {
        if (layer.sourceDocumentLineId === sourceDocumentLineId) {
          layers.set(id, {
            ...layer,
            qtyRemaining: String(Number(layer.qtyRemaining) - Number(consumeQty)),
          });
        }
      }
    },
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

  it("creates a cost layer and stamps movement cost on post", async () => {
    const { uow } = makeFake("3");
    const result = await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    expect(result.movements[0]?.unitCost).toBe("10");
    expect(result.movements[0]?.totalCost).toBe("30");
    const layers = await uow.run((ctx) =>
      ctx.costing.listOpenLayers("org-1", { productId: "product-1" }),
    );
    expect(layers).toHaveLength(1);
    expect(layers[0]?.qtyRemaining).toBe("3");
    expect(layers[0]?.unitCost).toBe("10");
  });

  it("rejects post when unit cost missing and no PO cost", async () => {
    const { uow } = makeFake({
      lineUnitCost: null,
      poUnitCost: null,
      withPo: false,
    });
    await expect(
      new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(MissingUnitCostError);
  });

  it("rejects post when product costing method is avg", async () => {
    const { uow } = makeFake({ costingMethod: "avg" });
    await expect(
      new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(UnsupportedCostingMethodError);
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

  it("void closes open layers", async () => {
    const { uow } = makeFake("3");
    await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    await new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    const open = await uow.run((ctx) =>
      ctx.costing.listOpenLayers("org-1", { productId: "product-1" }),
    );
    expect(open).toHaveLength(0);
  });

  it("enriches GR void outbox with inventoryValueDelta", async () => {
    const { uow, outbox } = makeFake("3");
    await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    await new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    const voidEvt = outbox.find(
      (e) =>
        e.eventType === "document.voided" && e.aggregateType === "goods_receipt",
    );
    expect(voidEvt?.payload.inventoryValueDelta).toBe("30");
  });

  it("includes branchId on document.posted outbox payload", async () => {
    const { uow, outbox } = makeFake("3");
    await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    const posted = outbox.find(
      (e) =>
        e.eventType === "document.posted" && e.aggregateType === "goods_receipt",
    );
    expect(posted?.payload.branchId).toBe("branch-1");
  });

  it("void rejects when layer partially consumed", async () => {
    const { uow, partiallyConsumeLayer } = makeFake("3");
    await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    partiallyConsumeLayer("gr-line-1", "1");
    await expect(
      new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(LayerInUseError);
  });
});
