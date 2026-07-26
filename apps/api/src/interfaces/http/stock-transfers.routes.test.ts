import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockTransferUseCases,
  VoidStockTransfer,
  createFakeCosting,
  type IdempotencyRecord,
  type StockTransferWithLines,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Location,
  Product,
  StockBalance,
  StockMovement,
  StockTransfer,
} from "@stock-management/domain";
import { stockTransfersRoutes } from "./stock-transfers.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const BRANCH_ID = "00000000-0000-4000-8000-000000000003";
const FROM_LOCATION_ID = "00000000-0000-4000-8000-000000000004";
const TO_LOCATION_ID = "00000000-0000-4000-8000-000000000005";
const TRANSIT_LOCATION_ID = "00000000-0000-4000-8000-000000000006";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000007";
const now = new Date("2026-07-26T00:00:00.000Z");

function makeHarness(transitType: Location["type"] = "transit") {
  const product: Product = {
    id: PRODUCT_ID,
    orgId: ORG_ID,
    sku: "SKU-1",
    name: "Widget",
    uom: "EA",
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
  const locations = new Map<string, Location>(
    [
      [FROM_LOCATION_ID, "storage"],
      [TO_LOCATION_ID, "storage"],
      [TRANSIT_LOCATION_ID, transitType],
    ].map(([id, type]) => [
      id,
      {
        id,
        orgId: ORG_ID,
        branchId: BRANCH_ID,
        code: `LOC-${id.slice(-1)}`,
        name: `Location ${id.slice(-1)}`,
        type,
        status: "active",
        createdAt: now,
        updatedAt: now,
      } as Location,
    ]),
  );
  const transfers = new Map<string, StockTransferWithLines>();
  const balances = new Map<string, StockBalance>();
  const movements: StockMovement[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();
  let movementSequence = 0;
  const costing = createFakeCosting();
  void costing.insertLayer({
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: FROM_LOCATION_ID,
    lotId: null,
    sourceDocumentType: "goods_receipt",
    sourceDocumentId: "gr-seed",
    sourceDocumentLineId: "grl-seed",
    sourceMovementId: "m-seed",
    receivedAt: new Date("2026-01-01"),
    unitCost: "10",
    qtyOriginal: "10",
    qtyRemaining: "10",
  });

  for (const [locationId, qtyOnHand] of [
    [FROM_LOCATION_ID, "10"],
    [TRANSIT_LOCATION_ID, "0"],
    [TO_LOCATION_ID, "0"],
  ]) {
    balances.set(locationId, {
      id: randomUUID(),
      orgId: ORG_ID,
      productId: PRODUCT_ID,
      locationId,
      lotId: null,
      qtyOnHand,
      qtyReserved: "0",
      updatedAt: now,
    });
  }

  const transferRepo: NonNullable<UowContext["transfers"]> = {
    async list(orgId) {
      return [...transfers.values()].filter(
        (transfer) => transfer.orgId === orgId,
      );
    },
    async findById(orgId, id) {
      const transfer = transfers.get(id);
      return transfer?.orgId === orgId ? transfer : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const transfer: StockTransferWithLines = {
        id,
        orgId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        transitLocationId: input.transitLocationId,
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        shippedAt: null,
        receivedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          stockTransferId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      transfers.set(id, transfer);
      return transfer;
    },
    async update(orgId, id, input) {
      const current = await transferRepo.findById(orgId, id);
      if (!current) return null;
      const updated: StockTransferWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            stockTransferId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      transfers.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await transferRepo.findById(orgId, id);
      if (!current) throw new Error("Stock transfer not found");
      const updated: StockTransferWithLines = {
        ...current,
        status,
        shippedAt: status === "in_transit" ? occurredAt : current.shippedAt,
        receivedAt: status === "received" ? occurredAt : current.receivedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      transfers.set(id, updated);
      return updated;
    },
  };

  const ctx = {
    transfers: transferRepo,
    products: {
      async findById(_orgId: string, id: string) {
        return id === product.id ? product : null;
      },
    },
    locations: {
      async findById(orgId: string, id: string) {
        const location = locations.get(id);
        return location?.orgId === orgId ? location : null;
      },
    },
    stock: {
      async findBalance(key: Pick<StockBalance, "locationId">) {
        return balances.get(key.locationId) ?? null;
      },
      async setBalance(
        key: Pick<StockBalance, "orgId" | "productId" | "locationId" | "lotId">,
        qtyOnHand: string,
      ) {
        const current = balances.get(key.locationId);
        const balance: StockBalance = {
          id: current?.id ?? randomUUID(),
          ...key,
          qtyOnHand,
          qtyReserved: current?.qtyReserved ?? "0",
          updatedAt: now,
        };
        balances.set(key.locationId, balance);
        return balance;
      },
      async setQtyReserved(
        key: Pick<StockBalance, "orgId" | "productId" | "locationId" | "lotId">,
        qtyReserved: string,
      ) {
        const current = balances.get(key.locationId);
        const balance: StockBalance = {
          id: current?.id ?? randomUUID(),
          ...key,
          qtyOnHand: current?.qtyOnHand ?? "0",
          qtyReserved,
          updatedAt: now,
        };
        balances.set(key.locationId, balance);
        return balance;
      },
      async insertMovement(
        input: Omit<StockMovement, "id" | "createdAt"> & {
          createdAt?: Date;
          unitCost?: string | null;
          totalCost?: string | null;
        },
      ) {
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
      async updateMovementCosts(
        _orgId: string,
        movementId: string,
        unitCost: string,
        totalCost: string,
      ) {
        const movement = movements.find((candidate) => candidate.id === movementId);
        if (!movement) throw new Error("Movement not found");
        movement.unitCost = unitCost;
        movement.totalCost = totalCost;
        return movement;
      },
      async listBalances() {
        return [...balances.values()];
      },
      async listMovements() {
        return movements;
      },
    },
    serials: {
      async upsert() {
        throw new Error("Unexpected serial upsert");
      },
      async list() {
        return [];
      },
    },
    costing,
    outbox: { async enqueue() {} },
    idempotency: {
      async find(
        orgId: string,
        operation: string,
        externalSystem: string,
        externalId: string,
      ) {
        return (
          idempotency.get(
            `${orgId}:${operation}:${externalSystem}:${externalId}`,
          ) ?? null
        );
      },
      async save(record: IdempotencyRecord) {
        idempotency.set(
          `${record.orgId}:${record.operation}:${record.externalSystem}:${record.externalId}`,
          record,
        );
      },
    },
  } as unknown as UowContext;
  const uow: UnitOfWork = { run: (fn) => fn(ctx) };
  const useCases = {
    stockTransfers: new StockTransferUseCases(transferRepo),
    shipStockTransfer: new ShipStockTransfer(uow),
    receiveStockTransfer: new ReceiveStockTransfer(uow),
    voidStockTransfer: new VoidStockTransfer(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(stockTransfersRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: (locationId: string) => balances.get(locationId),
    getMovements: () => movements,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = {
  fromLocationId: FROM_LOCATION_ID,
  toLocationId: TO_LOCATION_ID,
  transitLocationId: TRANSIT_LOCATION_ID,
  documentNumber: "TRF-1001",
  lines: [{ productId: PRODUCT_ID, qty: "3", lineNumber: 1 }],
};

describe("stock transfer routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup(transitType: Location["type"] = "transit") {
    const harness = makeHarness(transitType);
    const app = await harness.buildApp();
    apps.push(app);
    return { app, harness };
  }

  async function createDraft(
    app: ReturnType<typeof Fastify>,
  ): Promise<StockTransferWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/stock-transfers",
      headers,
      payload: draftPayload,
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<StockTransferWithLines>();
  }

  it("supports CRUD, ship, and receive for a stock transfer", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/stock-transfers/${created.id}`,
      headers,
      payload: { documentNumber: "TRF-1001-A" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/stock-transfers",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/stock-transfers/${created.id}`,
      headers,
    });
    const ship = await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/ship`,
      headers,
    });
    const receive = await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/receive`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<StockTransferWithLines>().documentNumber).toBe(
      "TRF-1001-A",
    );
    expect(list.json<StockTransfer[]>()).toHaveLength(1);
    expect(get.json<StockTransferWithLines>()).toMatchObject({
      id: created.id,
    });
    expect(ship.statusCode, ship.body).toBe(200);
    expect(ship.json<{ transfer: StockTransfer }>().transfer.status).toBe(
      "in_transit",
    );
    expect(receive.statusCode, receive.body).toBe(200);
    expect(receive.json<{ transfer: StockTransfer }>().transfer.status).toBe(
      "received",
    );
    expect(harness.getBalance(FROM_LOCATION_ID)?.qtyOnHand).toBe("7");
    expect(harness.getBalance(TRANSIT_LOCATION_ID)?.qtyOnHand).toBe("0");
    expect(harness.getBalance(TO_LOCATION_ID)?.qtyOnHand).toBe("3");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["transfer_out", "transfer_in", "transfer_out", "transfer_in"]);
  });

  it("voids an in-transit transfer by restoring source stock", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);
    await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/ship`,
      headers,
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/void`,
      headers,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ transfer: StockTransfer }>().transfer.status).toBe(
      "void",
    );
    expect(harness.getBalance(FROM_LOCATION_ID)?.qtyOnHand).toBe("10");
    expect(harness.getBalance(TRANSIT_LOCATION_ID)?.qtyOnHand).toBe("0");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual([
      "transfer_out",
      "transfer_in",
      "transfer_in_void",
      "transfer_out_void",
    ]);
  });

  it("rejects void after a transfer is received", async () => {
    const { app } = await setup();
    const created = await createDraft(app);
    await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/ship`,
      headers,
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/receive`,
      headers,
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/void`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "INVALID_STATE" },
    });
  });

  it("rejects ship when the transit location is not type transit", async () => {
    const { app, harness } = await setup("storage");
    const created = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/stock-transfers/${created.id}/ship`,
      headers,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: "CONFLICT" },
    });
    expect(harness.getBalance(FROM_LOCATION_ID)?.qtyOnHand).toBe("10");
    expect(harness.getMovements()).toHaveLength(0);
  });
});
