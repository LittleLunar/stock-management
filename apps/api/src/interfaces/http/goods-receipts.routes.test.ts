import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  ApprovalPolicyUseCases,
  GoodsReceiptUseCases,
  PostGoodsReceipt,
  VoidGoodsReceipt,
  type ApprovalPolicyPort,
  type GoodsReceiptWithLines,
  type IdempotencyRecord,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  ApprovalDocumentType,
  ApprovalPolicy,
  CostLayer,
  GoodsReceipt,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { goodsReceiptsRoutes } from "./goods-receipts.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SUPPLIER_ID = "00000000-0000-4000-8000-000000000003";
const BRANCH_ID = "00000000-0000-4000-8000-000000000004";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000005";
const LOCATION_ID = "00000000-0000-4000-8000-000000000006";
const PO_ID = "00000000-0000-4000-8000-000000000007";
const PO_LINE_ID = "00000000-0000-4000-8000-000000000008";
const now = new Date("2026-07-26T00:00:00.000Z");

function createPermissiveApprovalPolicies(): ApprovalPolicyUseCases {
  const rows = new Map<string, ApprovalPolicy>();
  const key = (orgId: string, documentType: ApprovalDocumentType) =>
    `${orgId}:${documentType}`;
  for (const documentType of [
    "purchase_order",
    "stock_adjustment",
  ] as const) {
    rows.set(key(ORG_ID, documentType), {
      id: `pol-${documentType}`,
      orgId: ORG_ID,
      documentType,
      required: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  const port: ApprovalPolicyPort = {
    async list(orgId) {
      return [...rows.values()].filter((r) => r.orgId === orgId);
    },
    async findByDocumentType(orgId, documentType) {
      return rows.get(key(orgId, documentType)) ?? null;
    },
    async upsert(orgId, documentType, required) {
      const id = key(orgId, documentType);
      const existing = rows.get(id);
      const row: ApprovalPolicy = {
        id: existing?.id ?? `pol-${documentType}`,
        orgId,
        documentType,
        required,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rows.set(id, row);
      return row;
    },
  };
  return new ApprovalPolicyUseCases(port);
}

function makeHarness(options?: { orderedQty?: string; trackLot?: boolean }) {
  const po: PurchaseOrder = {
    id: PO_ID,
    orgId: ORG_ID,
    supplierId: SUPPLIER_ID,
    branchId: BRANCH_ID,
    status: "submitted",
    documentNumber: "PO-1001",
    expectedDate: null,
    createdAt: now,
    updatedAt: now,
  };
  const poLine: PurchaseOrderLine = {
    id: PO_LINE_ID,
    orgId: ORG_ID,
    purchaseOrderId: PO_ID,
    productId: PRODUCT_ID,
    orderedQty: options?.orderedQty ?? "5",
    receivedQty: "0",
    unitCost: "12.5",
    lineNumber: 1,
  };
  const product: Product = {
    id: PRODUCT_ID,
    orgId: ORG_ID,
    sku: "SKU-1",
    name: "Widget",
    uom: "EA",
    categoryId: null,
    trackLot: options?.trackLot ?? false,
    trackSerial: false,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  let currentPo = { ...po, lines: [poLine] };
  const receipts = new Map<string, GoodsReceiptWithLines>();
  const balances = new Map<string, StockBalance>();
  const movements: StockMovement[] = [];
  const layers = new Map<string, CostLayer>();
  const idempotency = new Map<string, IdempotencyRecord>();
  let movementSequence = 0;

  const balanceKey = (
    productId: string,
    locationId: string,
    lotId: string | null,
  ) => `${productId}:${locationId}:${lotId ?? ""}`;

  const gr: UowContext["gr"] = {
    async list(orgId) {
      return [...receipts.values()].filter(
        (receipt) => receipt.orgId === orgId,
      );
    },
    async findById(orgId, id) {
      const receipt = receipts.get(id);
      return receipt?.orgId === orgId ? receipt : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const receipt: GoodsReceiptWithLines = {
        id,
        orgId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        supplierId: input.supplierId ?? null,
        branchId: input.branchId,
        locationId: input.locationId,
        status: "draft",
        postedAt: null,
        voidedAt: null,
        createdAt: now,
        updatedAt: now,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          goodsReceiptId: id,
          productId: line.productId,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          qty: line.qty,
          unitCost: line.unitCost ?? null,
          lotId: line.lotId ?? null,
          lotCode: line.lotCode ?? null,
          expiryDate: line.expiryDate ?? null,
          serialNumbers: line.serialNumbers ?? [],
          lineNumber: line.lineNumber,
        })),
      };
      receipts.set(id, receipt);
      return receipt;
    },
    async update(orgId, id, input) {
      const current = await gr.findById(orgId, id);
      if (!current) return null;
      const updated: GoodsReceiptWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            goodsReceiptId: id,
            productId: line.productId,
            purchaseOrderLineId: line.purchaseOrderLineId ?? null,
            qty: line.qty,
            unitCost: line.unitCost ?? null,
            lotId: line.lotId ?? null,
            lotCode: line.lotCode ?? null,
            expiryDate: line.expiryDate ?? null,
            serialNumbers: line.serialNumbers ?? [],
            lineNumber: line.lineNumber,
          })) ?? current.lines,
        updatedAt: now,
      };
      receipts.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await gr.findById(orgId, id);
      if (!current) throw new Error("Goods receipt not found");
      const updated = {
        ...current,
        status,
        postedAt: status === "posted" ? occurredAt : current.postedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      receipts.set(id, updated);
      return updated;
    },
    async setLineLotId() {},
  };

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
        const line = currentPo.lines.find(
          (candidate) => candidate.id === lineId,
        );
        if (!line) throw new Error("Purchase order line not found");
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
    gr,
    products: {
      async findById(_orgId, id) {
        return id === product.id ? product : null;
      },
    },
    stock: {
      async findBalance(key) {
        return (
          balances.get(balanceKey(key.productId, key.locationId, key.lotId)) ??
          null
        );
      },
      async setBalance(key, qtyOnHand) {
        const existing = balances.get(
          balanceKey(key.productId, key.locationId, key.lotId),
        );
        const balance: StockBalance = {
          id: existing?.id ?? randomUUID(),
          ...key,
          qtyOnHand,
          qtyReserved: existing?.qtyReserved ?? "0",
          updatedAt: now,
        };
        balances.set(
          balanceKey(key.productId, key.locationId, key.lotId),
          balance,
        );
        return balance;
      },
      async setQtyReserved(key, qtyReserved) {
        const existing = balances.get(
          balanceKey(key.productId, key.locationId, key.lotId),
        );
        const balance: StockBalance = {
          id: existing?.id ?? randomUUID(),
          ...key,
          qtyOnHand: existing?.qtyOnHand ?? "0",
          qtyReserved,
          updatedAt: now,
        };
        balances.set(
          balanceKey(key.productId, key.locationId, key.lotId),
          balance,
        );
        return balance;
      },
      async insertMovement(input) {
        const movement: StockMovement = {
          ...input,
          id: `movement-${++movementSequence}`,
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
    lots: {
      async upsert(input) {
        return {
          id: input.lotId ?? randomUUID(),
          orgId: input.orgId,
          productId: input.productId,
          lotCode: input.lotCode ?? "LOT-1",
          expiryDate: input.expiryDate ?? null,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
      },
      async list() {
        return [];
      },
    },
    serials: {
      async upsert(input) {
        return {
          id: randomUUID(),
          ...input,
          locationId: input.locationId ?? null,
          status: "in_stock",
          createdAt: now,
          updatedAt: now,
        };
      },
      async list() {
        return [];
      },
    },
    costing: {
      async insertLayer(layer) {
        const created: CostLayer = {
          ...layer,
          originalUnitCost: layer.originalUnitCost ?? layer.unitCost,
          id: layer.id ?? randomUUID(),
        };
        layers.set(created.id, created);
        return created;
      },
      async getLayer(orgId, layerId) {
        const layer = layers.get(layerId);
        return layer && layer.orgId === orgId ? layer : null;
      },
      async listOpenLayers(orgId, filter) {
        return [...layers.values()].filter(
          (layer) =>
            layer.orgId === orgId &&
            Number(layer.qtyRemaining) > 0 &&
            (!filter.productId || layer.productId === filter.productId) &&
            (!filter.locationId || layer.locationId === filter.locationId),
        );
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
      async lockOpenLayersFifo() {
        return [];
      },
      async listOpenLayersBySourceLine() {
        return [];
      },
      async insertConsumption() {
        throw new Error("unused");
      },
      async listConsumptionsByMovementIds() {
        return [];
      },
      async listLayersForValuation(orgId, filter) {
        return [...layers.values()].filter((layer) => {
          if (layer.orgId !== orgId) return false;
          if (filter.productId && layer.productId !== filter.productId) return false;
          if (filter.locationId && layer.locationId !== filter.locationId) return false;
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
        throw new Error("unused");
      },
      async listAdjustmentsForLayers() {
        return [];
      },
      async listAdjustmentsBySourceDocument() {
        return [];
      },
      async upsertProductCostSummary(row) {
        return {
          id: row.id ?? randomUUID(),
          orgId: row.orgId,
          productId: row.productId,
          locationId: row.locationId,
          lotId: row.lotId,
          qtyRemainingSum: row.qtyRemainingSum,
          onHandValue: row.onHandValue,
          updatedAt: row.updatedAt ?? now,
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
          id: randomUUID(),
          orgId: key.orgId,
          productId: key.productId,
          locationId: key.locationId,
          lotId: key.lotId,
          qtyRemainingSum: String(qty),
          onHandValue: String(value),
          updatedAt: now,
        };
      },
      async listProductCostSummaries() {
        return [];
      },
    },
    outbox: {
      async enqueue() {},
    },
    idempotency: {
      async find(orgId, operation, externalSystem, externalId) {
        return (
          idempotency.get(
            `${orgId}:${operation}:${externalSystem}:${externalId}`,
          ) ?? null
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
  const uow: UnitOfWork = { run: (fn) => fn(ctx) };
  const useCases = {
    goodsReceipts: new GoodsReceiptUseCases(gr),
    postGoodsReceipt: new PostGoodsReceipt(uow, createPermissiveApprovalPolicies()),
    voidGoodsReceipt: new VoidGoodsReceipt(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(goodsReceiptsRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: () =>
      balances.get(balanceKey(PRODUCT_ID, LOCATION_ID, null)) ?? null,
    getMovements: () => movements,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = (qty = "3", lotCode?: string) => ({
  purchaseOrderId: PO_ID,
  supplierId: SUPPLIER_ID,
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  lines: [
    {
      productId: PRODUCT_ID,
      purchaseOrderLineId: PO_LINE_ID,
      qty,
      unitCost: "12.5",
      ...(lotCode ? { lotCode } : {}),
      lineNumber: 1,
    },
  ],
});

describe("goods receipt routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup(options?: { orderedQty?: string; trackLot?: boolean }) {
    const harness = makeHarness(options);
    const app = await harness.buildApp();
    apps.push(app);
    return { app, harness };
  }

  async function createDraft(
    app: ReturnType<typeof Fastify>,
    payload = draftPayload(),
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goods-receipts",
      headers,
      payload,
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<GoodsReceiptWithLines>();
  }

  it("creates, lists, retrieves, and updates a draft receipt", async () => {
    const { app } = await setup();
    const created = await createDraft(app);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/goods-receipts/${created.id}`,
      headers,
      payload: { lines: [{ ...draftPayload("2").lines[0], lineNumber: 1 }] },
    });
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/goods-receipts",
      headers,
    });
    const getResponse = await app.inject({
      method: "GET",
      url: `/api/v1/goods-receipts/${created.id}`,
      headers,
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<GoodsReceiptWithLines>().lines[0]?.qty).toBe(
      "2",
    );
    expect(listResponse.json<GoodsReceipt[]>()).toHaveLength(1);
    expect(getResponse.json<GoodsReceiptWithLines>()).toMatchObject({
      id: created.id,
    });
  });

  it("posting increases balance and voiding decreases it", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const postResponse = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/post`,
      headers,
    });
    expect(postResponse.statusCode).toBe(200);
    expect(harness.getBalance()?.qtyOnHand).toBe("3");

    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/void`,
      headers,
    });
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json<{ receipt: GoodsReceipt }>().receipt.status).toBe(
      "void",
    );
    expect(harness.getBalance()?.qtyOnHand).toBe("0");
  });

  it("returns the same result when an idempotency key is replayed", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const first = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/post`,
      headers,
      payload: { external_system: "wms", external_id: "receipt-42" },
    });
    const replay = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/post`,
      headers: {
        ...headers,
        "x-external-system": "wms",
        "x-external-id": "receipt-42",
      },
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(harness.getMovements()).toHaveLength(1);
    expect(harness.getBalance()?.qtyOnHand).toBe("3");
  });

  it("returns 400 when posting would over-receive a PO line", async () => {
    const { app, harness } = await setup({ orderedQty: "2" });
    const created = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/post`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "OVER_RECEIVE" } });
    expect(harness.getBalance()).toBeNull();
  });

  it("returns TrackingRequired when a lot-tracked product has no lot", async () => {
    const { app, harness } = await setup({ trackLot: true });
    const created = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/goods-receipts/${created.id}/post`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "TRACKING_REQUIRED" },
    });
    expect(harness.getBalance()).toBeNull();
  });
});
