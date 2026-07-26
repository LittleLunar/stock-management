import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  CostInquiryUseCases,
  StockInquiryUseCases,
  type LotPort,
  type SerialPort,
  type StockPort,
  type UnitOfWork,
} from "@stock-management/application";
import type {
  CostLayer,
  Lot,
  Serial,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { stockRoutes } from "./stock.routes.js";
import { contextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_PRODUCT_ID = "00000000-0000-4000-8000-000000000004";
const LOCATION_ID = "00000000-0000-4000-8000-000000000005";
const OTHER_LOCATION_ID = "00000000-0000-4000-8000-000000000006";
const LOT_ID = "00000000-0000-4000-8000-000000000007";
const now = new Date("2026-07-26T00:00:00.000Z");
const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };

const balances: StockBalance[] = [
  {
    id: "balance-low",
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: LOT_ID,
    qtyOnHand: "2",
    qtyReserved: "0",
    updatedAt: now,
  },
  {
    id: "balance-healthy",
    orgId: ORG_ID,
    productId: OTHER_PRODUCT_ID,
    locationId: OTHER_LOCATION_ID,
    lotId: null,
    qtyOnHand: "12",
    qtyReserved: "0",
    updatedAt: now,
  },
];

const movements: StockMovement[] = [
  {
    id: "movement-1",
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: LOT_ID,
    documentType: "goods_receipt",
    documentId: "receipt-1",
    documentLineId: "receipt-line-1",
    movementType: "receipt",
    qty: "2",
    unitCost: "10",
    totalCost: "20",
    createdAt: now,
  },
  {
    id: "movement-2",
    orgId: ORG_ID,
    productId: OTHER_PRODUCT_ID,
    locationId: OTHER_LOCATION_ID,
    lotId: null,
    documentType: "goods_receipt",
    documentId: "receipt-2",
    documentLineId: "receipt-line-2",
    movementType: "receipt",
    qty: "12",
    unitCost: "5",
    totalCost: "60",
    createdAt: now,
  },
];

const lots: Lot[] = [
  {
    id: LOT_ID,
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    lotCode: "LOT-100",
    expiryDate: new Date("2027-07-26T00:00:00.000Z"),
    status: "active",
    createdAt: now,
    updatedAt: now,
  },
];

const serials: Serial[] = [
  {
    id: "serial-1",
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    lotId: LOT_ID,
    locationId: LOCATION_ID,
    serialNumber: "SN-100",
    status: "in_stock",
    createdAt: now,
    updatedAt: now,
  },
];

const costLayers: CostLayer[] = [
  {
    id: "layer-1",
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: LOT_ID,
    sourceDocumentType: "goods_receipt",
    sourceDocumentId: "00000000-0000-4000-8000-000000000010",
    sourceDocumentLineId: "00000000-0000-4000-8000-000000000011",
    sourceMovementId: "movement-1",
    receivedAt: now,
    unitCost: "10",
    qtyOriginal: "2",
    qtyRemaining: "2",
  },
];

class InMemoryStockRepository implements StockPort {
  async findBalance(): Promise<StockBalance | null> {
    return null;
  }

  async setBalance(): Promise<StockBalance> {
    throw new Error("Not implemented for inquiry tests");
  }

  async setQtyReserved(): Promise<StockBalance> {
    throw new Error("Not implemented for inquiry tests");
  }

  async insertMovement(): Promise<StockMovement> {
    throw new Error("Not implemented for inquiry tests");
  }

  async listBalances(
    orgId: string,
    filters?: { productId?: string; locationId?: string; lowStock?: boolean },
  ): Promise<StockBalance[]> {
    return balances.filter(
      (balance) =>
        balance.orgId === orgId &&
        (!filters?.productId || balance.productId === filters.productId) &&
        (!filters?.locationId || balance.locationId === filters.locationId) &&
        (!filters?.lowStock || Number(balance.qtyOnHand) <= 2),
    );
  }

  async listMovements(
    orgId: string,
    filters?: { productId?: string; locationId?: string },
  ): Promise<StockMovement[]> {
    return movements.filter(
      (movement) =>
        movement.orgId === orgId &&
        (!filters?.productId || movement.productId === filters.productId) &&
        (!filters?.locationId || movement.locationId === filters.locationId),
    );
  }
}

class InMemoryLotRepository implements LotPort {
  async upsert(): Promise<Lot> {
    throw new Error("Not implemented for inquiry tests");
  }

  async list(orgId: string, filters?: { productId?: string }): Promise<Lot[]> {
    return lots.filter(
      (lot) =>
        lot.orgId === orgId &&
        (!filters?.productId || lot.productId === filters.productId),
    );
  }
}

class InMemorySerialRepository implements SerialPort {
  async upsert(): Promise<Serial> {
    throw new Error("Not implemented for inquiry tests");
  }

  async list(
    orgId: string,
    filters?: { productId?: string },
  ): Promise<Serial[]> {
    return serials.filter(
      (serial) =>
        serial.orgId === orgId &&
        (!filters?.productId || serial.productId === filters.productId),
    );
  }
}

describe("stock inquiry routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup() {
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    const uow: UnitOfWork = {
      run(fn) {
        return fn({
          costing: {
            async insertLayer() {
              throw new Error("unused");
            },
            async getLayer() {
              return null;
            },
            async listOpenLayers(orgId, filter) {
              return costLayers.filter(
                (layer) =>
                  layer.orgId === orgId &&
                  Number(layer.qtyRemaining) > 0 &&
                  (!filter.productId || layer.productId === filter.productId) &&
                  (!filter.locationId || layer.locationId === filter.locationId),
              );
            },
            async listLayersBySourceDocument() {
              return [];
            },
            async setQtyRemaining() {},
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
          },
        } as never);
      },
    };
    await app.register(
      stockRoutes(
        new StockInquiryUseCases(
          new InMemoryStockRepository(),
          new InMemoryLotRepository(),
          new InMemorySerialRepository(),
        ),
        new CostInquiryUseCases(uow),
      ),
      { prefix: "/api/v1" },
    );
    return app;
  }

  it("lists stock balances", async () => {
    const app = await setup();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/stock/balances",
      headers,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<StockBalance[]>()).toMatchObject([
      { id: "balance-low", productId: PRODUCT_ID },
      { id: "balance-healthy", productId: OTHER_PRODUCT_ID },
    ]);
  });

  it("filters balances to low-stock rows", async () => {
    const app = await setup();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stock/balances?lowStock=true&productId=${PRODUCT_ID}&locationId=${LOCATION_ID}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<StockBalance[]>()).toMatchObject([
      { id: "balance-low", qtyOnHand: "2" },
    ]);
  });

  it("filters stock movements", async () => {
    const app = await setup();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stock/movements?productId=${PRODUCT_ID}&locationId=${LOCATION_ID}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<StockMovement[]>()).toMatchObject([
      { id: "movement-1", productId: PRODUCT_ID, locationId: LOCATION_ID },
    ]);
  });

  it("lists lots and serials for a product", async () => {
    const app = await setup();

    const [lotsResponse, serialsResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: `/api/v1/stock/lots?productId=${PRODUCT_ID}`,
        headers,
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/stock/serials?productId=${PRODUCT_ID}`,
        headers,
      }),
    ]);

    expect(lotsResponse.statusCode).toBe(200);
    expect(lotsResponse.json<Lot[]>()).toMatchObject([
      { id: LOT_ID, lotCode: "LOT-100" },
    ]);
    expect(serialsResponse.statusCode).toBe(200);
    expect(serialsResponse.json<Serial[]>()).toMatchObject([
      { serialNumber: "SN-100", lotId: LOT_ID },
    ]);
  });

  it("lists open cost layers", async () => {
    const app = await setup();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/stock/cost-layers?productId=${PRODUCT_ID}&locationId=${LOCATION_ID}`,
      headers,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject([
      {
        id: "layer-1",
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        unitCost: "10",
        qtyRemaining: "2",
      },
    ]);
  });
});
